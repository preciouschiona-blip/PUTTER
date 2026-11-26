package com.putter.app.ui

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Checkbox
import androidx.compose.material3.CheckboxDefaults
import androidx.compose.material3.FilterChip
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.runtime.snapshots.SnapshotStateList
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalUriHandler
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.putter.app.BuildConfig
import com.putter.app.UiState
import com.putter.app.data.PickDto
import com.putter.app.domain.ago
import com.putter.app.domain.combine
import com.putter.app.domain.fmtDayTime
import com.putter.app.domain.groupPerf
import com.putter.app.domain.monthKey
import com.putter.app.domain.parseTime
import com.putter.app.domain.perf
import com.putter.app.domain.weekKey

@Composable
fun AccumulatorScreen(s: UiState) {
    val chosen: SnapshotStateList<String> = remember { mutableStateListOf() }
    var stakeText by rememberSaveable { mutableStateOf("10") }
    var includeAmber by rememberSaveable { mutableStateOf(false) }
    val pool = s.picks.filter { upcoming(it) && (it.grade == "GREEN" || includeAmber) }.sortedBy { parseTime(it.kickoff) }
    val legs = pool.filter { it.id in chosen }
    Column {
        Banner("Accumulators are high risk: every selection must win. Selections on the same match are correlated and are priced with their exact joint probability, not by multiplying.", Amber)
        Row(verticalAlignment = Alignment.CenterVertically) {
            FilterChip(selected = includeAmber, onClick = { includeAmber = !includeAmber }, label = { Text("Include AMBER") })
        }
        if (pool.isEmpty()) EmptyState("Nothing to combine", "Qualified selections appear here when available.")
        pool.forEach { p ->
            AppCard(onClick = { if (p.id in chosen) chosen.remove(p.id) else chosen.add(p.id) }) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Checkbox(checked = p.id in chosen, onCheckedChange = { if (it) chosen.add(p.id) else chosen.remove(p.id) }, colors = CheckboxDefaults.colors(checkedColor = Green, checkmarkColor = Navy))
                    Column(Modifier.weight(1f)) {
                        Text("${p.homeTeam} v ${p.awayTeam}", fontWeight = FontWeight.Bold, fontSize = 14.sp)
                        Text("${p.selectionLabel} · ${p.marketLabel}", color = Grey, fontSize = 12.sp)
                    }
                    Text(f2(p.odds), fontWeight = FontWeight.ExtraBold, fontSize = 20.sp)
                }
            }
        }
        SectionTitle("Slip")
        OutlinedTextField(value = stakeText, onValueChange = { stakeText = it.filter { c -> c.isDigit() || c == '.' }.take(9) }, label = { Text("Stake") }, singleLine = true, keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal), modifier = Modifier.fillMaxWidth())
        Spacer(Modifier.height(8.dp))
        if (legs.size < 2) Text("Select at least 2 selections.", color = Grey, fontSize = 13.sp)
        else {
            val stake = stakeText.toDoubleOrNull() ?: 0.0
            val r = combine(legs, stake)
            AppCard {
                RowLine("Selections", "${r.selections}")
                RowLine("Individual odds", legs.joinToString(" × ") { f2(it.odds) })
                RowLine("Combined odds", f2(r.combinedOdds), Green)
                RowLine("Estimated combined probability", pct(r.probability))
                RowLine("Potential payout", f2(r.payout))
                RowLine("Potential profit", f2(r.profit))
                RowLine("Expected value per unit", signed(r.ev * 100) + "%", if (r.ev > 0) Green else Red)
                RowLine("Risk", r.risk, if (r.risk == "MODERATE") Amber else Red)
                if (r.correlated) Text("Includes correlated same-match legs.", color = Amber, fontSize = 12.sp)
            }
            Text("Even when each leg has value, a long accumulator will usually lose. Only stake what you can afford to lose.", color = Grey, fontSize = 11.sp, modifier = Modifier.padding(top = 6.dp))
        }
    }
}

@Composable
fun ResultsScreen(s: UiState, onPick: (PickDto) -> Unit) {
    var mode by rememberSaveable { mutableStateOf(0) }
    var greenOnly by rememberSaveable { mutableStateOf(true) }
    val base = s.picks.filter { it.isDemo != true }
    val list = if (greenOnly) base.filter { it.grade == "GREEN" } else base
    Column {
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            FilterChip(selected = mode == 0, onClick = { mode = 0 }, label = { Text("Tickets") })
            FilterChip(selected = mode == 1, onClick = { mode = 1 }, label = { Text("Single picks") })
        }
        if (mode == 0) { TicketResults(s); return@Column }
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            FilterChip(selected = greenOnly, onClick = { greenOnly = true }, label = { Text("GREEN only") })
            FilterChip(selected = !greenOnly, onClick = { greenOnly = false }, label = { Text("All published") })
        }
        Text("Every published recommendation is kept permanently, including losers. Flat 1-unit stake per pick.", color = Grey, fontSize = 12.sp, modifier = Modifier.padding(vertical = 6.dp))
        PerfGrid(perf(list))
        val sections = listOf<Pair<String, (PickDto) -> String>>(
            "By league" to { p -> p.league }, "By market" to { p -> p.marketLabel },
            "By month" to { p -> monthKey(parseTime(p.kickoff)) }, "By week" to { p -> weekKey(parseTime(p.kickoff)) },
        )
        sections.forEach { (title, key) ->
            val rows = groupPerf(list, key)
            if (rows.isNotEmpty()) {
                SectionTitle(title)
                AppCard { rows.take(12).forEach { (k, p) -> RowLine("$k  (${p.won}W-${p.lost}L)", signed(p.roi) + "% ROI", if (p.roi >= 0) Green else Red) } }
            }
        }
        SectionTitle("History")
        if (list.isEmpty()) EmptyState("No predictions recorded yet", "The record starts with the first published pick.")
        list.sortedByDescending { parseTime(it.kickoff) }.take(100).forEach { p ->
            AppCard(onClick = { onPick(p) }) {
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                    Text(fmtDayTime(parseTime(p.kickoff)), color = Grey, fontSize = 11.sp)
                    Text(p.result, color = when (p.result) { "WON" -> Green; "LOST" -> Red; "VOID" -> Grey; else -> Amber }, fontWeight = FontWeight.Bold, fontSize = 12.sp)
                }
                Text("${p.homeTeam} v ${p.awayTeam}", fontWeight = FontWeight.SemiBold)
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                    Text("${p.selectionLabel} @ ${f2(p.odds)}  ·  ${p.grade}", color = Grey, fontSize = 12.sp)
                    if (p.homeGoals != null) Text("${p.homeGoals}-${p.awayGoals}", fontSize = 12.sp)
                }
            }
        }
    }
}

@Composable
fun ProfileScreen(s: UiState, loading: Boolean, error: String?, onRefresh: () -> Unit) {
    val uri = LocalUriHandler.current
    Column {
        SectionTitle("Data status")
        AppCard {
            RowLine("Last app sync", ago(s.lastSyncMs))
            RowLine("Last server analysis", s.lastRun?.finishedAt?.let { ago(parseTime(it)) } ?: "none yet")
            RowLine("Last run result", when (s.lastRun?.ok) { true -> "OK"; false -> "FAILED"; else -> "–" }, if (s.lastRun?.ok == false) Red else White)
            s.lastRun?.message?.let { Text(it, color = Grey, fontSize = 12.sp) }
            if (error != null) Text(error, color = Amber, fontSize = 12.sp, modifier = Modifier.padding(top = 6.dp))
            Spacer(Modifier.height(8.dp))
            Button(onClick = onRefresh, enabled = !loading, colors = ButtonDefaults.buttonColors(containerColor = Green, contentColor = Navy)) { Text(if (loading) "Refreshing..." else "Refresh now") }
        }
        SectionTitle("Server configuration (read only)")
        AppCard {
            if (s.settings.isEmpty()) Text("Not loaded yet.", color = Grey, fontSize = 13.sp)
            s.settings.forEach { (k, v) -> RowLine(k, v) }
            Text("To change minimum odds, thresholds or leagues, edit the rows in the Supabase 'config' table. No rebuild needed.", color = Grey, fontSize = 11.sp, modifier = Modifier.padding(top = 8.dp))
        }
        SectionTitle("Responsible betting")
        AppCard {
            BulletList(listOf(
                "Predictions are probabilities, not guaranteed outcomes.",
                "Past performance does not guarantee future results.",
                "Never stake money you cannot afford to lose.",
                "Putter never claims a sure win. Treat anyone who does as a red flag.",
                "Set limits before you bet, and stop if betting stops being fun.",
                "Betting is for adults only, and may be restricted where you live.",
            ))
            Text("Help and information: begambleaware.org", color = Green, fontSize = 13.sp, modifier = Modifier.padding(top = 8.dp).clickable { uri.openUri("https://www.begambleaware.org") })
            Text("Free international support: gamblingtherapy.org", color = Green, fontSize = 13.sp, modifier = Modifier.padding(top = 6.dp).clickable { uri.openUri("https://www.gamblingtherapy.org") })
        }
        SectionTitle("About")
        AppCard {
            RowLine("Version", BuildConfig.VERSION_NAME)
            Text("Putter analyses fixtures with form, injury and bookmaker data. Odds come from a live odds provider and are never invented. Picks without verified odds are not recommended.", color = Grey, fontSize = 12.sp)
        }
    }
}

@Composable
fun TicketResults(s: UiState) {
    val real = s.tickets.filter { it.isDemo != true }
    Text("Every published ticket is kept permanently, including losers. Flat 1-unit stake per ticket; a ticket only wins when every selection wins.", color = Grey, fontSize = 12.sp, modifier = Modifier.padding(vertical = 6.dp))
    TicketPerfGrid(com.putter.app.domain.ticketPerf(real))
    SectionTitle("Ticket history")
    if (real.isEmpty()) EmptyState("No tickets recorded yet", "The record starts with the first published ticket.")
    real.sortedByDescending { parseTime(it.firstKickoff) }.take(60).forEach { TicketCard(it, compact = true) }
}
