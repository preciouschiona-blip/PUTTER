package com.putter.app

import android.app.Application
import androidx.work.Constraints
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.NetworkType
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import com.putter.app.work.RefreshWorker
import java.util.concurrent.TimeUnit

class PutterApp : Application() {
    override fun onCreate() {
        super.onCreate()
        val req = PeriodicWorkRequestBuilder<RefreshWorker>(3, TimeUnit.HOURS)
            .setConstraints(Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build())
            .build()
        WorkManager.getInstance(this).enqueueUniquePeriodicWork("putter-refresh", ExistingPeriodicWorkPolicy.KEEP, req)
    }
}
