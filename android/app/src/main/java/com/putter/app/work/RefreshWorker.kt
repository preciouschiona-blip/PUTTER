package com.putter.app.work

import android.Manifest
import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Context
import android.content.pm.PackageManager
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.content.ContextCompat
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import com.putter.app.R
import com.putter.app.data.PickDto
import com.putter.app.data.Repository
import com.putter.app.domain.parseTime
import kotlinx.coroutines.flow.first

class RefreshWorker(private val ctx: Context, params: WorkerParameters) : CoroutineWorker(ctx, params) {
    override suspend fun doWork(): Result {
        val repo = Repository(ctx)
        val before = repo.picksFlow.first().map { it.id }.toSet()
        if (repo.refresh().isFailure) return Result.retry()
        val now = System.currentTimeMillis()
        val fresh = repo.picksFlow.first().map { repo.pick(it) }
            .filter { it.id !in before && it.grade == "GREEN" && it.isDemo != true && parseTime(it.kickoff) > now }
        if (before.isNotEmpty() && fresh.isNotEmpty()) notify(fresh)
        return Result.success()
    }

    private fun notify(picks: List<PickDto>) {
        if (Build.VERSION.SDK_INT >= 33 &&
            ContextCompat.checkSelfPermission(ctx, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) return
        val nm = ctx.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        nm.createNotificationChannel(NotificationChannel("picks", "New picks", NotificationManager.IMPORTANCE_DEFAULT))
        val n = NotificationCompat.Builder(ctx, "picks")
            .setSmallIcon(R.drawable.ic_launcher_foreground)
            .setContentTitle("${picks.size} new qualified selection${if (picks.size > 1) "s" else ""}")
            .setContentText(picks.first().let { "${it.homeTeam} v ${it.awayTeam}: ${it.selectionLabel} @ ${"%.2f".format(it.odds)}" })
            .setAutoCancel(true).build()
        nm.notify(1001, n)
    }
}
