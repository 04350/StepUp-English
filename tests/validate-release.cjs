const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
function ok(value, message) { if (!value) throw new Error(message); }
function read(relative) { return fs.readFileSync(path.join(root, relative), 'utf8'); }
const version = JSON.parse(read('version.json'));
ok(/^\d+\.\d+\.\d+$/.test(version.version), 'Invalid semantic version in version.json');
ok(Number.isInteger(version.androidVersionCode) && version.androidVersionCode > 0, 'Invalid Android version code');
const html = read('index.html');
ok(html.split('__STEPUP_VERSION__').length - 1 === 2, 'The UI must contain exactly two injected version placeholders');
const mainReadme = read('README.md');
const androidReadme = read('android/README.md');
const desktopReadme = read('desktop/README.md');
ok(mainReadme.includes(version.version), 'README is not aligned with version.json');
ok(!/v1\.3\.[12]/.test(androidReadme + desktopReadme), 'Platform documentation contains obsolete hard-coded versions');
const gradle = read('android/app/build.gradle');
ok(gradle.includes('../version.json') && gradle.includes('versionConfig.androidVersionCode') && gradle.includes('versionConfig.version'), 'Android Gradle must load its version from version.json');
const androidWorkflow = read('.github/workflows/build-android.yml');
const desktopWorkflow = read('.github/workflows/build-desktop.yml');
const releaseWorkflow = read('.github/workflows/release.yml');
ok(androidWorkflow.includes('workflow_call') && desktopWorkflow.includes('workflow_call'), 'Platform workflows must be reusable');
ok(androidWorkflow.includes('STEPUP_VERSION') && desktopWorkflow.includes('STEPUP_VERSION'), 'Platform artifact names must use the canonical version');
ok(!androidWorkflow.includes('softprops/action-gh-release') && !desktopWorkflow.includes('softprops/action-gh-release'), 'Individual platform builds must not publish partial releases');
ok(releaseWorkflow.includes('build-android.yml') && releaseWorkflow.includes('build-desktop.yml') && releaseWorkflow.includes('softprops/action-gh-release'), 'The central release workflow must build both platforms and publish once');
ok(releaseWorkflow.includes('needs.android.outputs.signed'), 'Release publication must require a stable signed Android APK');
ok(read('android/SIGNING.md').includes('STEPUP_ANDROID_KEYSTORE_BASE64'), 'Android signing secret setup must be documented');
console.log(JSON.stringify({version:version.version,androidVersionCode:version.androidVersionCode,versionSource:'version.json',platformBuilds:'reusable',atomicRelease:'configured',stableAndroidSigning:'gated',docs:'aligned'}, null, 2));
