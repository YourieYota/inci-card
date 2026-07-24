const fs = require('fs');
const path = require('path');
const https = require('https');

const BASE_URL = 'https://unpkg.com/@imgly/background-removal@1.7.0/bin/';
const FILES = [
  'ort-wasm.wasm',
  'ort-wasm-simd.wasm',
  'isnet_fp16.onnx',
  'isnet_quantized.onnx'
];

const TARGET_DIR = path.join(__dirname, '../public/assets/imgly');

if (!fs.existsSync(TARGET_DIR)) {
  fs.mkdirSync(TARGET_DIR, { recursive: true });
}

async function downloadFile(filename) {
  return new Promise((resolve, reject) => {
    const filePath = path.join(TARGET_DIR, filename);
    const file = fs.createWriteStream(filePath);
    
    https.get(BASE_URL + filename, (response) => {
      // Handle redirects (unpkg redirects to the actual CDN)
      if (response.statusCode === 302 || response.statusCode === 301) {
        https.get(response.headers.location, (res) => {
          res.pipe(file);
          file.on('finish', () => {
            file.close();
            console.log(`Downloaded ${filename}`);
            resolve();
          });
        }).on('error', reject);
      } else {
        response.pipe(file);
        file.on('finish', () => {
          file.close();
          console.log(`Downloaded ${filename}`);
          resolve();
        });
      }
    }).on('error', (err) => {
      fs.unlink(filePath, () => {});
      reject(err);
    });
  });
}

async function main() {
  console.log('Downloading @imgly/background-removal assets...');
  for (const file of FILES) {
    try {
      await downloadFile(file);
    } catch (e) {
      console.error(`Failed to download ${file}:`, e);
    }
  }
  console.log('All assets downloaded.');
}

main();
