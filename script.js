let currentController;

const searchNFTsInput = document.getElementById("searchNFTs");

const walletAddressInput = document.getElementById("walletAddress");
const viewNFTsButton = document.getElementById("viewNFTs");
const nftGrid = document.getElementById("nftGrid");
walletAddressInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    displayNFTs();
  }
});

async function* fetchNFTsGenerator(walletAddress, signal) {
  const mirrorNodeUrl = "https://mainnet-public.mirrornode.hedera.com";
  let nextPage = `${mirrorNodeUrl}/api/v1/accounts/${walletAddress}/nfts?order=desc`;

  while (nextPage) {
    let response;
    try {
      response = await fetch(nextPage, { signal });

    } catch (error) {
      throw new Error(`Network error: ${error.message}`);
    }

    if (!response.ok) {
      throw new Error(`Failed to fetch NFTs: ${response.statusText}`);
    }

    const data = await response.json();

    for (const nft of data.nfts) {
      const metadataUrlBase64 = nft.metadata;
      const metadataUrlDecoded = atob(metadataUrlBase64).replace(
        "ipfs://",
        "https://dweb.link/ipfs/"
      );
      let metadata;
      try {
        const metadataResponse = await fetch(metadataUrlDecoded);

        if (metadataResponse.ok) {
          const contentType = metadataResponse.headers.get("content-type");

          if (contentType.includes("json")) {
            metadata = await metadataResponse.json();
          } else {
            console.warn(
              `Unsupported content type: ${contentType} for ${nft.token_id}`
            );
            metadata = {
              name: "N/A",
              image: "",
            };
          }
        } else {
          console.warn(
            `Error fetching metadata for ${nft.token_id}: ${metadataResponse.status} ${metadataResponse.statusText}`
          );
          metadata = {
            name: "N/A",
            image: "",
          };
        }
      } catch (error) {
        console.warn(
          `Error fetching metadata for ${nft.token_id}: ${error.message}`
        );
        metadata = {
          name: "Could not load",
          image: "",
        };
      }

      const imageUrl =
        metadata.image && typeof metadata.image === "string"
          ? metadata.image.replace("ipfs://", "https://dweb.link/ipfs/")
          : "";

      yield {
        id: nft.token_id,
        name: metadata.name,
        image: imageUrl,
        serial: nft.serial_number,
      };
    }

    nextPage =
      data.links && data.links.next
        ? `${mirrorNodeUrl}${data.links.next}`
        : null;
  }
}

function createMediaElement(mediaUrl, altText) {
  const fileExtension = mediaUrl.split(".").pop().toLowerCase();
  let mediaElement;

  if (["mp4", "webm", "ogg"].includes(fileExtension)) {
    mediaElement = document.createElement("video");
    mediaElement.setAttribute("controls", "");
    mediaElement.setAttribute("preload", "metadata");
  } else {
    mediaElement = document.createElement("img");
  }

  mediaElement.src = mediaUrl;
  mediaElement.alt = altText;

  function handleError() {
    mediaElement.src = "na.png";
    mediaElement.removeEventListener("error", handleError);
  }

  mediaElement.addEventListener("error", handleError);

  return mediaElement;
}

let nfts = [];

searchNFTsInput.addEventListener("input", () => {
  const searchTerm = searchNFTsInput.value;
  filterNFTs(nfts, searchTerm);
});


function displaySingleNFT(nft) {
  const nftElement = document.createElement("div");
  nftElement.classList.add("nft");

  const mediaElement = createMediaElement(nft.image, nft.name);

  const titleElement = document.createElement("h3");
  titleElement.textContent = nft.name;

  const serialNumberElement = document.createElement("p");
  serialNumberElement.textContent = `#${nft.serial}`;

  nftElement.appendChild(mediaElement);
  nftElement.appendChild(titleElement);
  nftElement.appendChild(serialNumberElement);

  nftGrid.appendChild(nftElement);
}


async function displayNFTs() {
  let walletAddress = walletAddressInput.value;

  if (walletAddress.indexOf("0.0.") === -1) {
    walletAddress = `0.0.${walletAddress}`;
  }

  console.log(walletAddress);

  if (!walletAddress) {
    alert("Enter an address.");
    return;
  }

  nftGrid.innerHTML = "";
  nfts = [];
  const displayedNftUniqueKeys = new Set(); // Create a set to store unique NFT keys (id|serial)

  try {
    const nftGenerator = fetchNFTsGenerator(walletAddress);
    for await (const nft of nftGenerator) {
      const uniqueKey = `${nft.id}|${nft.serial}`; // Create a unique key using the token ID and serial number

      if (!displayedNftUniqueKeys.has(uniqueKey)) { // Check if the unique key is not already displayed
        displayedNftUniqueKeys.add(uniqueKey); // Add the unique key to the set
        nfts.push(nft);
        const nftElement = document.createElement("div");
        nftElement.classList.add("nft");

        const mediaElement = createMediaElement(nft.image, nft.name);

        const titleElement = document.createElement("h3");
        titleElement.textContent = nft.name;

        const serialNumberElement = document.createElement("p");
        serialNumberElement.textContent = `#${nft.serial}`;

        nftElement.appendChild(mediaElement);
        nftElement.appendChild(titleElement);
        nftElement.appendChild(serialNumberElement);

        nftGrid.appendChild(nftElement);
      }
    }
  } catch (error) {
    alert(`Error fetching NFTs: ${error.message}`);
  }
}


viewNFTsButton.addEventListener("click", () => {
  displayNFTs().catch((error) => {
    console.error(`Error displaying NFTs: ${error.message}`);
  });
});


function filterNFTs(nfts, searchTerm) {
  const filteredNFTs = nfts.filter((nft) =>
    nft.name.toLowerCase().includes(searchTerm.toLowerCase())
  );
  nftGrid.innerHTML = "";

  filteredNFTs.forEach((nft) => {
    const nftElement = document.createElement("div");
    nftElement.classList.add("nft");

    const mediaElement = createMediaElement(nft.image, nft.name);

    const titleElement = document.createElement("h3");
    titleElement.textContent = nft.name;

    const serialNumberElement = document.createElement("p");
    serialNumberElement.textContent = `#${nft.serial}`;

    nftElement.appendChild(mediaElement);
    nftElement.appendChild(titleElement);
    nftElement.appendChild(serialNumberElement);

    nftGrid.appendChild(nftElement);
  });
}
