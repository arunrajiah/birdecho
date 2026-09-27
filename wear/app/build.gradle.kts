import groovy.json.JsonSlurper

plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("org.jetbrains.kotlin.plugin.compose")
}

// Version comes from the phone app's app.json so the two never drift. The watch
// APK must have a different versionCode from the phone APK of the same release
// (both share one applicationId on Google Play), hence the +1_000_000 offset.
@Suppress("UNCHECKED_CAST")
val expo = (JsonSlurper().parse(rootProject.file("../app.json")) as Map<String, Any>)["expo"] as Map<String, Any>
val phoneVersionName = expo["version"] as String
val phoneVersionCode = ((expo["android"] as Map<String, Any>)["versionCode"] as Number).toInt()

android {
    namespace = "dev.arunrajiah.birdecho.wear"
    compileSdk = 36

    defaultConfig {
        // Same applicationId as the phone app: required for the Wearable Data
        // Layer to deliver the station config from phone to watch.
        applicationId = "dev.arunrajiah.birdecho"
        minSdk = 30
        targetSdk = 36
        versionCode = 1_000_000 + phoneVersionCode
        versionName = phoneVersionName
    }

    signingConfigs {
        create("release") {
            val store = System.getenv("WEAR_KEYSTORE_FILE")
            if (store != null) {
                storeFile = file(store)
                storePassword = System.getenv("ANDROID_KEYSTORE_PASSWORD")
                keyAlias = System.getenv("ANDROID_KEY_ALIAS")
                keyPassword = System.getenv("ANDROID_KEY_PASSWORD")
            }
        }
    }

    buildTypes {
        release {
            // Not minified: the release APK then runs the same code that is tested
            // in debug builds (release builds cannot use the debug station hook).
            isMinifyEnabled = false
            if (System.getenv("WEAR_KEYSTORE_FILE") != null) {
                signingConfig = signingConfigs.getByName("release")
            }
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions {
        jvmTarget = "17"
    }
    buildFeatures {
        compose = true
    }
}

dependencies {
    implementation("androidx.activity:activity-compose:1.12.4")
    implementation("androidx.lifecycle:lifecycle-runtime-ktx:2.10.0")
    implementation("androidx.wear.compose:compose-material3:1.5.6")
    implementation("androidx.wear.compose:compose-foundation:1.5.6")

    implementation("androidx.wear.tiles:tiles:1.6.2")
    implementation("androidx.wear.protolayout:protolayout:1.4.2")

    implementation("androidx.work:work-runtime-ktx:2.12.0")
    implementation("androidx.security:security-crypto:1.1.0")

    implementation("com.google.android.gms:play-services-wearable:20.0.1")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-play-services:1.10.2")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-guava:1.10.2")
}
