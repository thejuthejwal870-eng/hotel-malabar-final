plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "in.malabarhotel.adminalerts"
    compileSdk = 35
    defaultConfig {
        applicationId = "in.malabarhotel.adminalerts"
        minSdk = 26
        targetSdk = 35
        versionCode = 10
        versionName = "1.0.9"
    }
}
kotlin { jvmToolchain(17) }
dependencies { implementation("androidx.core:core-ktx:1.15.0") }
