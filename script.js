let currentController;


function formatCID(cid) {
  if (!cid.startsWith('ipfs://') && !cid.startsWith('https://')) {
    return 'ipfs://' + cid;
  }
  return cid;
}


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
      const metadataUrlDecoded = atob(metadataUrlBase64);
      const formattedMetadataUrl = formatCID(metadataUrlDecoded).replace(
        "ipfs://",
        "https://dweb.link/ipfs/"
      );
      
      let metadata;
      try {
        const metadataResponse = await fetch(formattedMetadataUrl);

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

      let imageCID = "";

if (metadata.image && typeof metadata.image === "string") {
  const ipfsPrefix = "ipfs://";
  if (metadata.image.startsWith(ipfsPrefix)) {
    imageCID = metadata.image.slice(ipfsPrefix.length);
  } else {
    const cloudflarePrefix = "https://cloudflare-ipfs.com/ipfs/";
    if (metadata.image.startsWith(cloudflarePrefix)) {
      imageCID = metadata.image.slice(cloudflarePrefix.length);
    }
  }
}


      yield {
        id: nft.token_id,
        name: metadata.name,
        image: imageCID, // Pass the image CID instead of the URL
        serial: nft.serial_number,
      };
      
    }

    nextPage =
      data.links && data.links.next
        ? `${mirrorNodeUrl}${data.links.next}`
        : null;
  }
}

async function createMediaElement(imageCID, altText) {
  const fileExtension = imageCID.split(".").pop().toLowerCase();
  let mediaElement;

console.log(fileExtension);
  if (["mp4", "webm", "ogg", "qmwc1kalbjppa3emrwmbyujbrzuo9p8qcvgjiaki6bxdm9", "bakreibc6qwoabajozfdgziiwtwp2hp2tqd2mnjtljqvl3gkadfu7ed2fe4"

].includes(fileExtension)) {
    mediaElement = document.createElement("video");
    mediaElement.setAttribute("controls", "");
    mediaElement.setAttribute("preload", "metadata");
    mediaElement.setAttribute("autoplay", "");
    mediaElement.setAttribute("loop", "");
  } else if (fileExtension === "gltf") {
    const canvas = document.createElement("canvas");
    await loadGLTFModel(canvas, mediaUrl);
    mediaElement = canvas;
  } else {
    mediaElement = document.createElement("img");
    mediaElement.setAttribute("loading", "lazy"); // Add lazy loading attribute
  }

  if (imageCID) {
    const ipfsURL = `https://ipfs.io/ipfs/${imageCID}`;
    mediaElement.src = ipfsURL;
  } else {
    mediaElement.src = "na.png";
  }



  // error handling
  mediaElement.onerror = () => {
    mediaElement.src = "na.png";

  };

  mediaElement.alt = altText;

  return mediaElement;
}



async function loadGLTFModel(canvas, modelUrl) {
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true });
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(
    75,
    canvas.width / canvas.height,
    0.1,
    1000
  );
  camera.position.z = 5;
  const controls = new THREE.OrbitControls(camera, renderer.domElement);

  const loader = new THREE.GLTFLoader();
  try {
    const gltf = await loader.loadAsync(modelUrl);
    scene.add(gltf.scene);
  } catch (error) {
    console.error(`Error loading GLTF: ${error.message}`);
  }

  const animate = function () {
    requestAnimationFrame(animate);
    renderer.render(scene, camera);
  };

  renderer.setSize(canvas.width, canvas.height);
  animate();
}

let nfts = [];

searchNFTsInput.addEventListener("input", () => {
  const searchTerm = searchNFTsInput.value;
  filterNFTs(nfts, searchTerm);
});


async function displaySingleNFT(nft) {
  const nftElement = document.createElement("div");
  nftElement.classList.add("nft");

  const mediaElement = await createMediaElement(nft.image, nft.name);

  const titleElement = document.createElement("h3");
  titleElement.textContent = nft.name;

  const serialNumberElement = document.createElement("p");
  serialNumberElement.textContent = `#${nft.serial}`;

  const tokenIdElement = document.createElement("p");
  tokenIdElement.textContent = `${nft.id}`;

  nftElement.appendChild(mediaElement);
  nftElement.appendChild(titleElement);
  nftElement.appendChild(serialNumberElement);
  nftElement.appendChild(tokenIdElement);


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

        const mediaElement = await createMediaElement(nft.image, nft.name);

        const titleElement = document.createElement("h3");
        titleElement.textContent = nft.name;

        const serialNumberElement = document.createElement("p");
        serialNumberElement.textContent = `#${nft.serial}`;

        const tokenIdElement = document.createElement("p");
        tokenIdElement.textContent = `${nft.id}`;

        nftElement.appendChild(mediaElement);
        nftElement.appendChild(titleElement);
        nftElement.appendChild(serialNumberElement);
        nftElement.appendChild(tokenIdElement);

        nftGrid.appendChild(nftElement);
        // Remove this line: await displaySingleNFT(nft);
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


async function filterNFTs(nfts, searchTerm) {
  const filteredNFTs = nfts.filter((nft) =>
    nft.name.toLowerCase().includes(searchTerm.toLowerCase())
  );
  nftGrid.innerHTML = "";


    for (const nft of filteredNFTs) {
      const nftElement = document.createElement("div");
      nftElement.classList.add("nft");
  
      const mediaElement = await createMediaElement(nft.image, nft.name);

    const titleElement = document.createElement("h3");
    titleElement.textContent = nft.name;

    const serialNumberElement = document.createElement("p");
    serialNumberElement.textContent = `#${nft.serial}`;

    const tokenIdElement = document.createElement("p");
    tokenIdElement.textContent = `${nft.id}`;

    nftElement.appendChild(mediaElement);
    nftElement.appendChild(titleElement);
    nftElement.appendChild(serialNumberElement);
    nftElement.appendChild(tokenIdElement);

    nftGrid.appendChild(nftElement);
  }
}
