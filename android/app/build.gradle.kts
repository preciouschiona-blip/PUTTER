plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("org.jetbrains.kotlin.plugin.compose")
    id("com.google.devtools.ksp")
}

fun cfg(name: String): String =
    (project.findProperty(name) as String?)?.takeIf { it.isNotEmpty() } ?: System.getenv(name) ?: ""

// Public, read-only values (the anon key can only read; row level security blocks writes).
// A build can override them with the SUPABASE_URL / SUPABASE_ANON_KEY environment variables.
val defaultSupabaseUrl = "https://rfsmywipfwpwclgjammf.supabase.co"
val defaultSupabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJmc215d2lwZndwd2NsZ2phbW1mIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTU3MTgyOTIsImV4cCI6MjExMTI5NDI5Mn0.KiHgewHRmPU5_5xu9K_i8WdP195xJzZa5HUrGuJrzMM"

android {
    namespace = "com.putter.app"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.putter.app"
        minSdk = 26
        targetSdk = 35
        versionCode = 2
        versionName = "1.1.0"
        // Public, read-only values (anon key is protected by row level security; writes need the service key).
        buildConfigField("String", "SUPABASE_URL", "\"${cfg("SUPABASE_URL").ifEmpty { defaultSupabaseUrl }}\"")
        buildConfigField("String", "SUPABASE_ANON_KEY", "\"${cfg("SUPABASE_ANON_KEY").ifEmpty { defaultSupabaseAnonKey }}\"")
    }

    signingConfigs {
        if (cfg("KEYSTORE_PATH").isNotEmpty()) {
            create("release") {
                storeFile = file(cfg("KEYSTORE_PATH"))
                storePassword = cfg("KEYSTORE_PASSWORD")
                keyAlias = cfg("KEY_ALIAS")
                keyPassword = cfg("KEYSTORE_PASSWORD")
            }
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            signingConfig = signingConfigs.findByName("release") ?: signingConfigs.getByName("debug")
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions { jvmTarget = "17" }
    buildFeatures { compose = true; buildConfig = true }
    packaging { resources.excludes += "/META-INF/{AL2.0,LGPL2.1}" }
}

dependencies {
    val composeBom = platform("androidx.compose:compose-bom:2024.12.01")
    implementation(composeBom)
    implementation("androidx.compose.ui:ui")
    implementation("androidx.compose.ui:ui-graphics")
    implementation("androidx.compose.foundation:foundation")
    implementation("androidx.compose.material3:material3")
    implementation("androidx.compose.material:material-icons-core")
    implementation("androidx.activity:activity-compose:1.9.3")
    implementation("androidx.core:core-ktx:1.15.0")
    implementation("androidx.lifecycle:lifecycle-viewmodel-compose:2.8.7")
    implementation("androidx.lifecycle:lifecycle-runtime-compose:2.8.7")

    implementation("com.squareup.retrofit2:retrofit:2.11.0")
    implementation("com.squareup.retrofit2:converter-gson:2.11.0")
    implementation("com.squareup.okhttp3:okhttp:4.12.0")

    implementation("androidx.room:room-runtime:2.6.1")
    implementation("androidx.room:room-ktx:2.6.1")
    ksp("androidx.room:room-compiler:2.6.1")

    implementation("androidx.work:work-runtime-ktx:2.10.0")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.9.0")
}
