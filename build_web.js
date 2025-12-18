const fs = require('fs');
const path = require('path');

const src = __dirname;
const dest = path.join(__dirname, 'web_build');

if (!fs.existsSync(dest)) fs.mkdirSync(dest);

// Copy index.html
fs.copyFileSync(path.join(src, 'index.html'), path.join(dest, 'index.html'));

// Copy Dir Helper
function copyDir(source, destination) {
    if (!fs.existsSync(destination)) fs.mkdirSync(destination);
    const files = fs.readdirSync(source);
    for (const file of files) {
        const curSource = path.join(source, file);
        const curDest = path.join(destination, file);
        if (fs.lstatSync(curSource).isDirectory()) {
            copyDir(curSource, curDest);
        } else {
            fs.copyFileSync(curSource, curDest);
        }
    }
}

// Copy JS and Styles
if (fs.existsSync(path.join(src, 'js'))) copyDir(path.join(src, 'js'), path.join(dest, 'js'));
if (fs.existsSync(path.join(src, 'styles'))) copyDir(path.join(src, 'styles'), path.join(dest, 'styles'));
if (fs.existsSync(path.join(src, 'assets'))) copyDir(path.join(src, 'assets'), path.join(dest, 'assets'));

console.log('Web Build Created in', dest);
