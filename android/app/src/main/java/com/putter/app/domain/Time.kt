package com.putter.app.domain

import java.time.Instant
import java.time.OffsetDateTime
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.Locale

fun parseTime(s: String?): Long = runCatching { OffsetDateTime.parse(s).toInstant().toEpochMilli() }
    .recoverCatching { Instant.parse(s).toEpochMilli() }.getOrDefault(0L)

private val zone: ZoneId get() = ZoneId.systemDefault()
private val timeFmt = DateTimeFormatter.ofPattern("HH:mm", Locale.getDefault())
private val dayFmt = DateTimeFormatter.ofPattern("EEE d MMM", Locale.getDefault())
private val dateLong = DateTimeFormatter.ofPattern("EEEE, d MMMM yyyy", Locale.getDefault())
private val monthFmt = DateTimeFormatter.ofPattern("MMM yyyy", Locale.getDefault())

fun fmtTime(ms: Long): String = Instant.ofEpochMilli(ms).atZone(zone).format(timeFmt)
fun fmtDay(ms: Long): String = Instant.ofEpochMilli(ms).atZone(zone).format(dayFmt)
fun fmtDayTime(ms: Long): String = "${fmtDay(ms)} ${fmtTime(ms)}"
fun todayLong(): String = Instant.now().atZone(zone).format(dateLong)
fun monthKey(ms: Long): String = Instant.ofEpochMilli(ms).atZone(zone).format(monthFmt)
fun weekKey(ms: Long): String {
    val d = Instant.ofEpochMilli(ms).atZone(zone).toLocalDate()
    val monday = d.minusDays((d.dayOfWeek.value - 1).toLong())
    return "Week of " + monday.format(DateTimeFormatter.ofPattern("d MMM", Locale.getDefault()))
}
fun isToday(ms: Long): Boolean = Instant.ofEpochMilli(ms).atZone(zone).toLocalDate() == Instant.now().atZone(zone).toLocalDate()

fun ago(ms: Long?): String {
    if (ms == null || ms == 0L) return "never"
    val m = (System.currentTimeMillis() - ms) / 60_000
    return when {
        m < 1 -> "just now"
        m < 60 -> "$m min ago"
        m < 1440 -> "${m / 60} h ago"
        else -> "${m / 1440} d ago"
    }
}
