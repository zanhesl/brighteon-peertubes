const fs = require('fs');
const dns = require('dns');

const JSON_FILE = 'list.json';
const BASTYON_URL = 'https://raw.githubusercontent.com/shpingalet007/bastyon-peertubes/master/list.json';

// Read JSON file
const jsonContent = JSON.parse(fs.readFileSync(JSON_FILE, 'utf-8'));

// Function to load Bastyon list from GitHub
const gatherBastyonList = async () => {
  const res = await fetch(BASTYON_URL);
  return res.json();
}

// Function to update IP for a given host
const updateIP = async (host) => {
  return new Promise((resolve, reject) => {
    dns.resolve4(host, (err, addresses) => {
      if (err) {
        console.error(`Failed to resolve IP for ${host}: ${err.message}`);
        resolve(null);
      } else {
        resolve(addresses[0]);
      }
    });
  });
};

const syncWithBastyonList = async () => {
  const bastyonList = await gatherBastyonList();

  // Remove hooked swarms (hooked = gathered from other lists)
  for (const swarmKey in jsonContent.swarms) {
    const swarm = jsonContent.swarms[swarmKey];

    if (swarm.hooked) {
        delete jsonContent.swarms[swarmKey];
    }
  }

  // Remove hooked archives (hooked = gathered from other lists)
  for (const archiveKey in jsonContent.archive) {
    const archive = jsonContent.archive[archiveKey];

    if (archive.hooked) {
        delete jsonContent.archive[archiveKey];
    }
  }

  // Gather Bastyon Peertube swarms list and prepare it
  for (const swarmKey in bastyonList.swarms) {
    let swarm = bastyonList.swarms[swarmKey];

    swarm = { hooked: true, ...swarm };

    for (const archiveIndex in swarm.archived) {
      const archiveKey = swarm.archived[archiveIndex];
      swarm.archived[archiveIndex] = `bastyon_${archiveKey}`;
    }

    for (const entry of swarm.list) {
      entry.upload = false;
      delete entry.special;
    }

    delete bastyonList.swarms[swarmKey];
    bastyonList.swarms[`bastyon_${swarmKey}`] = swarm;
  }

  // Gather Bastyon Peertube archive list and prepare it
  for (const archiveKey in bastyonList.archive) {
    let archive = bastyonList.archive[archiveKey];

    archive = { hooked: true, ...archive };
    archive.upload = false;

    delete bastyonList.archive[archiveKey];
    bastyonList.archive[`bastyon_${archiveKey}`] = archive;
  }

  // Merging Bastyon and Brighteon swarms list
  jsonContent.swarms = {
    ...bastyonList.swarms,
    ...jsonContent.swarms,
  };

  // Merging Bastyon and Brighteon archives list
  jsonContent.archive = {
    ...bastyonList.archive,
    ...jsonContent.archive,
  };
};

// Function to update IP and set online status for each host in the JSON
const updateIPs = async () => {
  await syncWithBastyonList();

  for (const swarmKey in jsonContent.swarms) {
    const swarm = jsonContent.swarms[swarmKey];
    if (swarm.list) {
      for (const entry of swarm.list) {
        if (!entry.online) {
          delete entry.ip;
          continue;
        }

        const ip = await updateIP(entry.host);
        if (ip) {
          entry.ip = ip;
          entry.online = true;
        } else {
          entry.online = false;
        }
      }
    }
  }
};

// Run the updateIPs function
updateIPs().then(() => {
  // Rearrange the properties to have "ip" next to "host"
  for (const swarmKey in jsonContent.swarms) {
    const swarm = jsonContent.swarms[swarmKey];
    if (swarm.list) {
      for (let i = 0; i < swarm.list.length; i++) {
        let entry = swarm.list[i];

        swarm.list[i] = {
          host: entry.host,
          ip: entry.ip,
          upload: entry.upload,
          online: entry.online,
        };
      }
    }
  }

  const jsonString = JSON.stringify({
    ...jsonContent,
    lastChecked: Date.now(),
  }, null, 2);

  // Write updated JSON back to file
  fs.writeFileSync(JSON_FILE, jsonString);
  console.log('IP addresses and online status updated successfully.');
}).catch((error) => {
  console.error('Error updating IP addresses and online status:', error);
  process.exit(1);
});
