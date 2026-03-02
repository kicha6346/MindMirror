const http = require('http');

async function test() {
  console.log("Fetching score for dummy user...");
  http.get('http://localhost:3000/api/score', (resp) => {
    let data = '';
    resp.on('data', (chunk) => { data += chunk; });
    resp.on('end', () => {
      console.log("Response:", JSON.stringify(JSON.parse(data), null, 2));
    });
  }).on("error", (err) => {
    console.log("Error: " + err.message);
  });
}

test();
