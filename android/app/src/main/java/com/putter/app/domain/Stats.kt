package com.putter.app.domain

import com.putter.app.data.PickDto

data class Perf(
    val total: Int, val won: Int, val lost: Int, val void: Int, val pending: Int,
    val winPct: Double, val avgOdds: Double, val roi: Double, val profit: Double, val clv: Double?,
)

/** Flat 1-unit stake per pick. Void picks return the stake. Demo rows never count. */
fun perf(all: List<PickDto>): Perf {
    val l = all.filter { it.isDemo != true }
    val won = l.count { it.result == "WON" }; val lost = l.count { it.result == "LOST" }
    val void = l.count { it.result == "VOID" }; val pending = l.count { it.result == "PENDING" }
    val staked = won + lost
    val profit = l.sumOf { if (it.result == "PENDING") 0.0 else (it.profit ?: 0.0) }
    val settled = l.filter { it.result == "WON" || it.result == "LOST" }
    val clvList = l.filter { it.closingOdds != null && it.closingOdds > 1.0 }.map { it.odds / it.closingOdds!! - 1 }
    return Perf(
        total = l.size, won = won, lost = lost, void = void, pending = pending,
        winPct = if (staked > 0) 100.0 * won / staked else 0.0,
        avgOdds = if (l.isNotEmpty()) l.map { it.odds }.average() else 0.0,
        roi = if (staked > 0) 100.0 * profit / staked else 0.0,
        profit = profit,
        clv = if (clvList.isNotEmpty()) 100.0 * clvList.average() else null,
    )
}

fun groupPerf(list: List<PickDto>, key: (PickDto) -> String): List<Pair<String, Perf>> =
    list.filter { it.isDemo != true && it.result != "PENDING" }.groupBy(key).map { it.key to perf(it.value) }
        .sortedByDescending { it.second.total }
