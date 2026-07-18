const axios = require("axios");

const API = "http://127.0.0.1:3000/logs";

const domains = [
  { domain: "youtube.com", app: "YouTube" },
  { domain: "facebook.com", app: "Facebook" },
  { domain: "google.com", app: "Google" },
  { domain: "github.com", app: "GitHub" },
  { domain: "twitter.com", app: "Twitter" },
  { domain: "netflix.com", app: "Netflix" }
];

function randomIP() {
  return `${Math.floor(Math.random()*255)}.${Math.floor(Math.random()*255)}.${Math.floor(Math.random()*255)}.${Math.floor(Math.random()*255)}`;
}

async function generateTraffic(count = 200) {

  for (let i = 0; i < count; i++) {

    const site = domains[Math.floor(Math.random()*domains.length)];

    const log = {
      src_ip: randomIP(),
      dest_ip: "142.250.185.206",
      protocol: "HTTPS",
      domain: site.domain,
      application: site.app,
      bytes: Math.floor(Math.random()*5000),
      packets: Math.floor(Math.random()*20),
      action: Math.random() > 0.8 ? "blocked" : "allowed"
    };

    try {

      await axios.post(API, log);

      console.log(`Sent ${i+1}:`, log.domain);

    } catch (err) {

      console.error("Error:", err.response?.data || err.message);

    }

  }

}

generateTraffic(300);