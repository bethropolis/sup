#!/usr/bin/env node

const fs = require('fs-extra');
const FormData = require('form-data');
const tar = require('tar');
const path = require('path');
const request = require('request');
const AdmZip = require('adm-zip');
const axios = require('axios');
const bcrypt = require('bcrypt');
const os = require('os');
const packageJson = require('./package.json');
const BASE_URL = 'https://bethro.alwaysdata.net/test/plugins';


async function downloadPackage(packageName) {
  const packageUrl = `${BASE_URL}/${packageName}.supl`;
  const packagePath = path.join(__dirname, `${packageName}.supl`);

  let receivedBytes = 0;
  let totalBytes = 0;

  const request = require('request')(packageUrl);
  let status = true
  request
    .on('response', (response) => {
      if (response.statusCode !== 200) {
				status = false;
        console.error(`Failed to download package: ${response.statusMessage}`);
        return;
      }

      totalBytes = parseInt(response.headers['content-length'], 10);
    })
    .on('data', (chunk) => {
      receivedBytes += chunk.length;

      const barLength = 20;
      const percent = ((receivedBytes / totalBytes) * 100).toFixed(2);
      const filledLength = Math.round(barLength * (receivedBytes / totalBytes));
      const emptyLength = barLength - filledLength;
      const progressBar = '█'.repeat(filledLength) + '░'.repeat(emptyLength);
      const color = percent >= 100 ? '\x1b[32m' : '\x1b[33m';
      process.stdout.write(`\r${color}Downloading ${packageName}: ${percent}% ${progressBar}\x1b[0m`);
    })
    .pipe(fs.createWriteStream(packagePath));

  await new Promise((resolve, reject) => {
    request.on('end', resolve);
    request.on('error', reject);
  });

  console.log(`\nDownloaded ${packageName} successfully!`);
}


function extractPackage(packageName) {
  const packagePath = path.join(__dirname, `${packageName}.supl`);
  const extractDir = path.join(__dirname, packageName);

  if (!fs.existsSync(packagePath)) {
    console.error(`Package ${packageName} not found.`);
    return;
  }

  console.log(`Extracting ${packageName}...`);

  const zip = new AdmZip(packagePath);
  zip.extractAllTo(extractDir, true);
  console.log(`${packageName} extracted successfully!`);
}

function installPackage(packageName) {
  const packagePath = path.join(__dirname, `${packageName}.supl`);

  fs.access(packagePath, fs.constants.F_OK, (err) => {
    if (err) {
      downloadPackage(packageName)
        .then(() => extractPackage(packageName))
        .catch((err) => console.error(`Failed to install package: ${err.message}`));
    } else {
      console.log(`Package ${packageName} already exists.`);
    }
  });
}

function initPackage(packageName) {
  const packageDir = path.join(__dirname, packageName);

  if (fs.existsSync(packageDir)) {
    console.error(`Package ${packageName} already exists.`);
    return;
  }

  console.log(`Creating package ${packageName}...`);

  fs.mkdirSync(packageDir);
  fs.mkdirSync(path.join(packageDir, 'assets'));
  fs.mkdirSync(path.join(packageDir, 'libs'));
  fs.mkdirSync(path.join(packageDir, 'src'));

  fs.writeFileSync(path.join(packageDir, '.signature'), '');
  fs.writeFileSync(path.join(packageDir, 'main.php'), '');
  fs.writeFileSync(path.join(packageDir, 'suplike.json'), JSON.stringify({
    name: packageName,
    version: '1.0.0',
    description: '',
    author: '',
    dependencies: {},
  }, null, 2));

  console.log(`Package ${packageName} created successfully!`);
}
function publishPackage(packageName, secretKey="aWJvdGFscGx1czRzdHJpbmcK") {
  const packageDir = path.join(__dirname, packageName);
  if (!fs.existsSync(packageDir)) {
    console.error(`Package ${packageName} not found.`);
    return;
  }

  // Validate package format
  const requiredFiles = ['.signature', 'main.php', 'suplike.json'];
  const packageFiles = fs.readdirSync(packageDir);
  for (const file of requiredFiles) {
    if (!packageFiles.includes(file)) {
      console.error(`Package ${packageName} is missing required file: ${file}`);
      return;
    }
  }

  // Read package data
  const packageData = fs.readFileSync(path.join(packageDir, 'suplike.json'));

  // Sign package
  const signature = signPackage(packageData, secretKey);
  const signaturePath = path.join(packageDir, '.signature');
  fs.writeFileSync(signaturePath, signature);

  // Create package archive
  const archivePath = createPackageArchive(packageName);

  // Upload package
  const form = new FormData();
  form.append('package', fs.createReadStream(archivePath));
  form.append('signature', fs.createReadStream(signaturePath));
  axios.post(`${BASE_URL}/upload`, form, {
    headers: form.getHeaders()
  })
  .then((response) => {
    console.log(`Package ${packageName} published successfully!`);
    // Download package files
    const downloadDir = path.join(__dirname, 'downloads', packageName);
    fs.mkdirSync(downloadDir, { recursive: true });
    const packageUrl = `${BASE_URL}/packages/${packageName}.supl`;
    const packageFilePath = path.join(downloadDir, `${packageName}.supl`);
    axios({
      method: 'get',
      url: packageUrl,
      responseType: 'stream'
    })
    .then((response) => {
      response.data.pipe(fs.createWriteStream(packageFilePath));
      response.data.on('end', () => {
        console.log(`Package ${packageName} downloaded successfully!`);
      });
    })
    .catch((error) => {
      console.error(`Failed to download package: ${error.message}`);
    });
  })
  .catch((error) => {
    console.error(`Failed to publish package: ${error.message}`);
  });
}

function createPackageArchive(packageName) {
  const packageDir = path.join(__dirname, packageName);
  const archivePath = path.join(os.tmpdir(), `${packageName}.supl`);
  const output = fs.createWriteStream(archivePath);
  const archive = require('archiver')('zip', { zlib: { level: 9 } });

  archive.on('error', (err) => {
    throw err;
  });

  archive.pipe(output);

  archive.directory(packageDir, packageName);

  archive.finalize();

  return archivePath;
}

function signPackage(packageData, secretKey) {
  const bcrypt = require('bcrypt');
  const salt = bcrypt.genSaltSync(10);
  const hash = bcrypt.hashSync(packageData, salt);
  return hash;
}
function removePackage(packageName) {
  const packageDir = path.join(__dirname, packageName);
  const packageSupl = path.join(__dirname, `${packageName}.supl`);

  if (fs.existsSync(packageDir)) {
    console.log(`Removing ${packageName}...`);
    fs.rmdirSync(packageDir, { recursive: true });
    console.log(`${packageName} removed successfully!`);
		console.log(`Removing ${packageName}.supl...`);
    fs.unlinkSync(packageSupl);
  } else if (fs.existsSync(packageSupl)) {
    console.log(`Removing ${packageName}.supl file...`);
    fs.unlinkSync(packageSupl);
    console.log(`${packageName}.supl removed successfully!`);
  } else {
    console.error(`Package ${packageName} not found.`);
  }
}


console.log(process.argv.length)
if (process.argv.length < 3) {
 console.log(`
						                            
		 _(.-■-■ ▼.ᴥ.▼__ _(ᵔᴥᵔ)_ 
		|       |  | |  |       |
		|  _____|  | |  |    _  |
		| |_____|  |_|  |   |_| |
		|_____  |       |    ___|
		 _____| |       |   |_ʖ°)
		|_______|_______|___|    
		
`);
    console.log(`Version: ${packageJson.version}\nUsage: sup [command]\n\nCommands:\n  sup\tDisplays an ASCII art saying "sup".\n  install\tInstalls a plugin from ${BASE_URL}.\n  add\tAdds a new plugin to the system.\n  remove\tRemoves a plugin from the system.`);
  process.exit(1);
}

const [command, packageName] = process.argv.slice(2);

switch (command) {
 case 'install':
    if (packageName) { 
      installPackage(packageName);
    } else {
      console.log('Please specify a package name to install.');
    }
    break;
  case 'remove':
    if (packageName) {
      removePackage(packageName);
    } else {
      console.log('Please specify a package name to remove.');
    }
    break;
		case 'init':
		 initPackage(packageName)
		break;
		case 'publish':
		 publishPackage(packageName)
		break;
  default:
    console.error(`Invalid command: ${command}`);
    console.error('Usage: sup [install|remove] <package>');
    process.exit(1);
}