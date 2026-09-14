#!/usr/bin/env node
/**
 * react-native-tts ships an ancient Android build.gradle that still calls
 * jcenter(), which modern Gradle no longer supports. Rewrite it on install.
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..', 'node_modules', 'react-native-tts', 'android');
const gradlePath = path.join(root, 'build.gradle');
const manifestPath = path.join(root, 'src', 'main', 'AndroidManifest.xml');

if (!fs.existsSync(gradlePath)) {
  process.exit(0);
}

const gradle = `def safeExtGet(prop, fallback) {
    rootProject.ext.has(prop) ? rootProject.ext.get(prop) : fallback
}

apply plugin: 'com.android.library'

android {
    namespace "net.no_mad.tts"
    compileSdkVersion safeExtGet('compileSdkVersion', 34)

    defaultConfig {
        minSdkVersion safeExtGet('minSdkVersion', 24)
        targetSdkVersion safeExtGet('targetSdkVersion', 34)
    }

    sourceSets {
        main {
            java.srcDirs = ['src/main/java']
            manifest.srcFile 'src/main/AndroidManifest.xml'
        }
    }
}

repositories {
    google()
    mavenCentral()
}

dependencies {
    implementation "com.facebook.react:react-android"
}
`;

fs.writeFileSync(gradlePath, gradle);
if (fs.existsSync(manifestPath)) {
  fs.writeFileSync(
    manifestPath,
    '<manifest xmlns:android="http://schemas.android.com/apk/res/android">\n</manifest>\n',
  );
}

console.log('Fixed react-native-tts Android Gradle (removed jcenter).');
