const fs = require('fs');
const dns = require('dns');

const JSON_FILE = 'list.json';

// Read JSON file
const jsonContent = JSON.parse(fs.readFileSync(JSON_FILE, 'utf-8'));

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

// Function to update IP and set online status for each host in the JSON
const updateIPs = async () => {
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

        if (entry.ip) {
          swarm.list[i] = {
            host: entry.host,
            ip: entry.ip,
            upload: entry.upload,
            special: entry.special,
            online: entry.online,
          };
        }
      }
    }
  }

  const jsonString = JSON.stringify({
    lastChecked: Date.now(),
    ...jsonContent,
  }, null, 2);

  // Write updated JSON back to file
  fs.writeFileSync(JSON_FILE, jsonString);
  console.log('IP addresses and online status updated successfully.');
}).catch((error) => {
  console.error('Error updating IP addresses and online status:', error);
  process.exit(1);
});
