package com.putter.app.domain

import com.putter.app.data.PickDto
import kotlin.math.exp
import kotlin.math.max
import kotlin.math.pow

/** 1 = win, 0 = push, -1 = lose. Mirrors backend/src/engine/poisson.js outcomeFn. */
fun outcome(marketId: String, h: Int, g: Int): Int {
    val p = marketId.split(":")
    return when (p[0]) {
        "1X2" -> if (when (p[1]) { "H" -> h > g; "D" -> h == g; else -> h < g }) 1 else -1
        "DC" -> if ((p[1] == "1X" && h >= g) || (p[1] == "X2" && h <= g) || (p[1] == "12" && h != g)) 1 else -1
        "DNB" -> if (h == g) 0 else if (if (p[1] == "H") h > g else h < g) 1 else -1
        "OU" -> {
            val line = p[1].toDouble(); val t = (h + g).toDouble()
            if (t == line) 0 else if (if (p[2] == "O") t > line else t < line) 1 else -1
        }
        "BTTS" -> if (((h > 0 && g > 0) == (p[1] == "Y"))) 1 else -1
        "TTS" -> if ((if (p[1] == "H") h else g) > 0) 1 else -1
        "AH" -> {
            val d = (if (p[1] == "H") h - g else g - h) + p[2].toDouble()
            if (d > 0) 1 else if (d == 0.0) 0 else -1
        }
        else -> -1
    }
}

fun jointWin(matrix: List<List<Double>>, a: String, b: String): Double {
    var s = 0.0
    for (h in matrix.indices) for (g in matrix[h].indices) if (outcome(a, h, g) == 1 && outcome(b, h, g) == 1) s += matrix[h][g]
    return s
}

fun poissonMatrix(lh: Double, la: Double, maxGoals: Int = 7, rho: Double = -0.06): List<List<Double>> {
    fun pmf(k: Int, l: Double): Double { var p = exp(-l); for (i in 1..k) p *= l / i; return p }
    fun tau(x: Int, y: Int): Double = when {
        x == 0 && y == 0 -> 1 - lh * la * rho
        x == 0 && y == 1 -> 1 + lh * rho
        x == 1 && y == 0 -> 1 + la * rho
        x == 1 && y == 1 -> 1 - rho
        else -> 1.0
    }
    val m = List(maxGoals + 1) { h -> MutableList(maxGoals + 1) { a -> max(0.0, pmf(h, lh) * pmf(a, la) * tau(h, a)) } }
    val total = m.sumOf { it.sum() }
    return m.map { r -> r.map { it / total } }
}

fun probOf(matrix: List<List<Double>>, marketId: String): Double {
    var s = 0.0
    for (h in matrix.indices) for (g in matrix[h].indices) if (outcome(marketId, h, g) == 1) s += matrix[h][g]
    return s
}

// ---------------- Accumulator ----------------
data class AccResult(
    val selections: Int, val combinedOdds: Double, val probability: Double, val payout: Double,
    val profit: Double, val ev: Double, val risk: String, val correlated: Boolean,
)

fun combine(legs: List<PickDto>, stake: Double): AccResult {
    var prob = 1.0; var correlated = false
    for ((_, g) in legs.groupBy { it.fixtureId }) {
        val p = { l: PickDto -> l.pAdj ?: (1.0 / l.odds) }
        prob *= when {
            g.size == 1 -> p(g[0])
            g.size == 2 && g[0].scoreMatrix != null -> { correlated = true; jointWin(g[0].scoreMatrix!!, g[0].marketId, g[1].marketId) }
            else -> { correlated = true; max(0.0, g.sumOf { p(it) } - (g.size - 1)) }
        }
    }
    val odds = legs.fold(1.0) { a, l -> a * l.odds }
    val risk = when {
        legs.size >= 6 || prob < 0.08 -> "VERY HIGH"
        legs.size >= 4 || prob < 0.18 -> "HIGH"
        legs.size >= 3 || prob < 0.35 -> "MEDIUM"
        else -> "MODERATE"
    }
    return AccResult(legs.size, odds, prob, stake * odds, stake * (odds - 1), prob * odds - 1, risk, correlated)
}
