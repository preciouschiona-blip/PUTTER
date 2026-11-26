package com.putter.app.ui

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.putter.app.data.PickDto
import com.putter.app.domain.Perf
import com.putter.app.domain.fmtDayTime
import com.putter.app.domain.fmtTime
import com.putter.app.domain.parseTime
import java.util.Locale

fun f2(x: Double) = String.format(Locale.US, "%.2f", x)
fun pct(x: Double?) = if (x == null) "–" else "${Math.round(x * 100)}%"
fun signed(x: Double, d: Int = 1) = String.format(Locale.US, "%+.${d}f", x)
fun gradeColor(g: String) = when (g) { "GREEN" -> Green; "AMBER" -> Amber; else -> Red }

@Composable
fun GradeChip(grade: String, demo: Boolean = false) {
    val c = gradeColor(grade)
    Row(verticalAlignment = Alignment.CenterVertically) {
        Box(Modifier.clip(RoundedCornerShape(50)).background(c.copy(alpha = 0.18f)).padding(horizontal = 10.dp, vertical = 3.dp)) {
            Text(grade, color = c, fontSize = 11.sp, fontWeight = FontWeight.Bold)
        }
        if (demo) {
            Spacer(Modifier.width(6.dp))
            Box(Modifier.clip(RoundedCornerShape(50)).background(Red.copy(alpha = 0.2f)).padding(horizontal = 8.dp, vertical = 3.dp)) {
                Text("DEMO DATA", color = Red, fontSize = 10.sp, fontWeight = FontWeight.Bold)
            }
        }
    }
}

@Composable
fun SectionTitle(text: String, modifier: Modifier = Modifier) =
    Text(text.uppercase(), modifier = modifier.padding(top = 18.dp, bottom = 8.dp), color = Grey, fontSize = 12.sp, fontWeight = FontWeight.Bold, letterSpacing = 1.sp)

@Composable
fun Banner(text: String, color: Color = Amber) {
    Box(Modifier.fillMaxWidth().padding(vertical = 4.dp).clip(RoundedCornerShape(10.dp)).background(color.copy(alpha = 0.14f)).padding(12.dp)) {
        Text(text, color = color, fontSize = 13.sp)
    }
}

@Composable
fun EmptyState(title: String, body: String) {
    Column(Modifier.fillMaxWidth().padding(vertical = 24.dp), horizontalAlignment = Alignment.CenterHorizontally) {
        Text(title, fontWeight = FontWeight.Bold, fontSize = 16.sp)
        Spacer(Modifier.height(6.dp))
        Text(body, color = Grey, fontSize = 13.sp)
    }
}

@Composable
fun AppCard(modifier: Modifier = Modifier, onClick: (() -> Unit)? = null, content: @Composable () -> Unit) {
    val m = modifier.fillMaxWidth().padding(vertical = 5.dp)
    Card(
        modifier = if (onClick != null) m.clickable { onClick() } else m,
        shape = RoundedCornerShape(16.dp), colors = CardDefaults.cardColors(containerColor = CardBg),
        border = BorderStroke(1.dp, Color.White.copy(alpha = 0.05f)),
    ) { Column(Modifier.padding(14.dp)) { content() } }
}

@Composable
fun Stat(label: String, value: String, color: Color = White, modifier: Modifier = Modifier) {
    Column(modifier) {
        Text(value, color = color, fontWeight = FontWeight.Bold, fontSize = 17.sp)
        Text(label, color = Grey, fontSize = 11.sp)
    }
}

@Composable
fun PickCard(p: PickDto, onClick: () -> Unit) {
    val k = parseTime(p.kickoff)
    AppCard(onClick = onClick) {
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
            Text("${p.league} · ${fmtDayTime(k)}", color = Grey, fontSize = 12.sp, modifier = Modifier.weight(1f))
            GradeChip(p.grade, p.isDemo == true)
        }
        Spacer(Modifier.height(8.dp))
        Text("${p.homeTeam} v ${p.awayTeam}", fontWeight = FontWeight.Bold, fontSize = 16.sp)
        Spacer(Modifier.height(4.dp))
        Row(verticalAlignment = Alignment.CenterVertically) {
            Column(Modifier.weight(1f)) {
                Text(p.selectionLabel, color = Green, fontWeight = FontWeight.SemiBold, fontSize = 15.sp)
                Text(p.marketLabel, color = Grey, fontSize = 12.sp)
            }
            Text(f2(p.odds), fontSize = 28.sp, fontWeight = FontWeight.ExtraBold, color = White)
        }
        Spacer(Modifier.height(10.dp))
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
            Stat("Est. probability", pct(p.pAdj))
            Stat("Expected value", p.ev?.let { signed(it * 100) + "%" } ?: "–", if ((p.ev ?: 0.0) > 0) Green else Red)
            Stat("Confidence", "${p.confidence ?: 0}/100")
        }
        val bk = listOfNotNull(p.bookmaker, p.oddsUpdated?.let { "updated " + fmtDayTime(parseTime(it)) }).joinToString(" · ")
        if (bk.isNotEmpty()) Text(bk, color = Grey, fontSize = 11.sp, modifier = Modifier.padding(top = 8.dp))
    }
}

@Composable
fun ProbBar(label: String, p: Double) {
    Column(Modifier.padding(vertical = 4.dp)) {
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
            Text(label, fontSize = 13.sp); Text(pct(p), fontSize = 13.sp, fontWeight = FontWeight.Bold)
        }
        LinearProgressIndicator(progress = { p.toFloat().coerceIn(0f, 1f) }, modifier = Modifier.fillMaxWidth().height(6.dp).clip(RoundedCornerShape(3.dp)), color = Green, trackColor = Color.White.copy(alpha = 0.08f))
    }
}

@Composable
fun PerfGrid(p: Perf) {
    AppCard {
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
            Stat("Predictions", "${p.total}")
            Stat("Won", "${p.won}", Green)
            Stat("Lost", "${p.lost}", Red)
            Stat("Void", "${p.void}")
            Stat("Pending", "${p.pending}", Amber)
        }
        Spacer(Modifier.height(14.dp))
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
            Stat("Win rate", "${String.format(Locale.US, "%.1f", p.winPct)}%")
            Stat("Avg odds", if (p.total > 0) f2(p.avgOdds) else "–")
            Stat("ROI", signed(p.roi) + "%", if (p.roi >= 0) Green else Red)
            Stat("Profit (units)", signed(p.profit, 2), if (p.profit >= 0) Green else Red)
        }
        if (p.clv != null) Text("Closing line value: ${signed(p.clv)}% (positive means prices beat the closing market)", color = Grey, fontSize = 11.sp, modifier = Modifier.padding(top = 10.dp))
    }
}

@Composable
fun RowLine(left: String, right: String, rightColor: Color = White) {
    Row(Modifier.fillMaxWidth().padding(vertical = 5.dp), horizontalArrangement = Arrangement.SpaceBetween) {
        Text(left, fontSize = 13.sp, modifier = Modifier.weight(1f)); Text(right, fontSize = 13.sp, color = rightColor, fontWeight = FontWeight.SemiBold)
    }
}

@Composable
fun BulletList(items: List<String>?, color: Color = White) {
    items.orEmpty().forEach { Text("•  $it", color = color, fontSize = 13.sp, modifier = Modifier.padding(vertical = 2.dp)) }
}

@Composable
fun mutedStyle() = MaterialTheme.typography.bodySmall

@Composable
fun TicketCard(t: com.putter.app.data.TicketDto, stake: Double = 10.0, compact: Boolean = false) {
    val first = parseTime(t.firstKickoff)
    AppCard {
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
            Text(t.name, fontWeight = FontWeight.Bold, fontSize = 15.sp, modifier = Modifier.weight(1f))
            GradeChip(t.grade, t.isDemo == true)
        }
        Text("First kick-off ${fmtDayTime(first)} · ${t.legs.size} selections", color = Grey, fontSize = 12.sp, modifier = Modifier.padding(top = 2.dp))
        Spacer(Modifier.height(8.dp))
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text("Combined odds", color = Grey, fontSize = 12.sp, modifier = Modifier.weight(1f))
            Text(f2(t.combinedOdds), fontSize = 30.sp, fontWeight = FontWeight.ExtraBold, color = Green)
        }
        Spacer(Modifier.height(6.dp))
        t.legs.forEachIndexed { i, l ->
            val r = t.legResults?.getOrNull(i)
            Row(Modifier.fillMaxWidth().padding(vertical = 5.dp), verticalAlignment = Alignment.CenterVertically) {
                Column(Modifier.weight(1f)) {
                    Text("${l.homeTeam} v ${l.awayTeam}", fontWeight = FontWeight.SemiBold, fontSize = 13.sp)
                    Text("${l.selectionLabel} · ${l.marketLabel ?: ""} · ${fmtTime(parseTime(l.kickoff))}", color = Grey, fontSize = 11.sp)
                    if (l.banker == true) Text("Strongest selection of the day", color = Green, fontSize = 10.sp)
                }
                if (r != null && r != "PENDING") Text(r, color = when (r) { "WON" -> Green; "LOST" -> Red; else -> Grey }, fontSize = 11.sp, fontWeight = FontWeight.Bold, modifier = Modifier.padding(end = 8.dp))
                Text(f2(l.odds), fontWeight = FontWeight.Bold, fontSize = 16.sp)
            }
        }
        if (!compact) {
            Row(Modifier.fillMaxWidth().padding(top = 8.dp), horizontalArrangement = Arrangement.SpaceBetween) {
                Stat("Est. chance all win", pct(t.probability))
                Stat("Expected value", t.ev?.let { signed(it * 100) + "%" } ?: "–", if ((t.ev ?: 0.0) > 0) Green else Red)
                Stat("Risk", t.risk ?: "–", Amber)
            }
            Text("${f2(stake)} staked would return ${f2(stake * t.combinedOdds)} if every selection wins.", color = Grey, fontSize = 11.sp, modifier = Modifier.padding(top = 8.dp))
            t.note?.let { Text(it, color = Amber, fontSize = 11.sp, modifier = Modifier.padding(top = 4.dp)) }
            Text("Every selection must win. Most tickets with odds this high lose, so stake only small amounts you can afford to lose.", color = Grey, fontSize = 11.sp, modifier = Modifier.padding(top = 4.dp))
        }
        if (t.result != "PENDING") Text("Result: ${t.result}", color = when (t.result) { "WON" -> Green; "LOST" -> Red; else -> Grey }, fontWeight = FontWeight.Bold, modifier = Modifier.padding(top = 6.dp))
    }
}

@Composable
fun TicketPerfGrid(p: com.putter.app.domain.TicketPerf) {
    AppCard {
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
            Stat("Tickets", "${p.total}"); Stat("Won", "${p.won}", Green); Stat("Lost", "${p.lost}", Red); Stat("Void", "${p.void}"); Stat("Pending", "${p.pending}", Amber)
        }
        Spacer(Modifier.height(14.dp))
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
            Stat("Hit rate", "${String.format(Locale.US, "%.1f", p.hitPct)}%")
            Stat("Avg odds", if (p.total > 0) f2(p.avgOdds) else "–")
            Stat("ROI", signed(p.roi) + "%", if (p.roi >= 0) Green else Red)
            Stat("Profit (units)", signed(p.profit, 2), if (p.profit >= 0) Green else Red)
        }
    }
}
