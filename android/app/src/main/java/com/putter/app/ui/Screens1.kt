package com.putter.app.ui

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Tab
import androidx.compose.material3.TabRow
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.putter.app.UiState
import com.putter.app.data.FixtureDto
import com.putter.app.data.PickDto
import com.putter.app.domain.ago
import com.putter.app.domain.fmtDay
import com.putter.app.domain.fmtDayTime
import com.putter.app.domain.fmtTime
import com.putter.app.domain.isToday
import com.putter.app.domain.parseTime
import com.putter.app.domain.perf
import com.putter.app.domain.poissonMatrix
import com.putter.app.domain.probOf
import com.putter.app.domain.todayLong

private fun now() = System.currentTimeMillis()
fun upcoming(p: PickDto) = p.result == "PENDING" && parseTime(p.kickoff) > now()

@Composable
fun StatusBanners(s: UiState) {
    val run = s.lastRun
    if (run?.ok == false) Banner("Latest server run failed: ${run.message ?: "unknown error"}", Red)
    if (s.picks.any { it.isDemo == true }) Banner("Demonstration data is present. DEMO rows use synthetic odds, are never graded GREEN and are excluded from performance statistics.", Red)
}

@Composable
fun HomeScreen(s: UiState, onPick: (PickDto) -> Unit, goTo: (Int) -> Unit) {
    val green = s.picks.filter { upcoming(it) && it.grade == "GREEN" }.sortedByDescending { it.score ?: 0.0 }
    val analysed = s.fixtures.count { it.analysisStatus == "analysed" && parseTime(it.kickoff) > now() }
    val live = s.picks.filter { it.isDemo != true && it.grade == "GREEN" }
    val pf = perf(live)
    val recent = live.filter { it.result == "WON" || it.result == "LOST" }.sortedByDescending { parseTime(it.kickoff) }.take(10)
    Column {
        Text(todayLong(), color = Grey, fontSize = 13.sp)
        StatusBanners(s)
        Row(Modifier.fillMaxWidth().padding(top = 8.dp), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            AppCard(Modifier.weight(1f)) { Stat("Matches analysed", "$analysed") }
            AppCard(Modifier.weight(1f)) { Stat("Qualified (GREEN)", "${green.size}", Green) }
            AppCard(Modifier.weight(1f)) { Stat("Overall ROI", if (pf.won + pf.lost > 0) signed(pf.roi) + "%" else "–", if (pf.roi >= 0) Green else Red) }
        }
        SectionTitle("Today's top picks")
        if (green.isEmpty()) EmptyState("No qualified selections right now", "Putter only publishes selections that clear every value and reliability check. Quiet days are normal and are not filled with weaker tips.")
        else green.take(3).forEach { PickCard(it, { onPick(it) }) }
        if (green.size > 3) Text("See all in Today's Picks →", color = Green, modifier = Modifier.padding(8.dp).clickable { goTo(1) })

        SectionTitle("Recent performance (GREEN picks)")
        if (recent.isEmpty()) Text("No settled predictions yet.", color = Grey, fontSize = 13.sp)
        else Row(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalAlignment = Alignment.CenterVertically) {
            recent.forEach { Box(Modifier.size(22.dp).clip(CircleShape).background(if (it.result == "WON") Green else Red), contentAlignment = Alignment.Center) { Text(if (it.result == "WON") "W" else "L", color = Navy, fontSize = 11.sp, fontWeight = FontWeight.Bold) } }
        }

        SectionTitle("Upcoming fixtures")
        val fx = s.fixtures.filter { parseTime(it.kickoff) > now() }.take(5)
        if (fx.isEmpty()) Text("No fixtures loaded yet. Tap refresh.", color = Grey, fontSize = 13.sp)
        fx.forEach { FixtureRow(it) }

        SectionTitle("Team news from analysed matches")
        val news = s.picks.filter { upcoming(it) }.flatMap { it.keyPlayers.orEmpty() }.distinct().take(6)
        if (news.isEmpty()) Text("No confirmed absences reported for qualified matches. A live news feed is not connected in this version.", color = Grey, fontSize = 13.sp)
        else BulletList(news)
        Text("Predictions are not guaranteed outcomes. Never stake money you cannot afford to lose.", color = Grey, fontSize = 11.sp, modifier = Modifier.padding(top = 20.dp))
    }
}


@Composable
fun FixtureRow(f: FixtureDto) {
    val k = parseTime(f.kickoff)
    AppCard {
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
            Text("${f.league}", color = Grey, fontSize = 12.sp, modifier = Modifier.weight(1f))
            Text(fmtDayTime(k), color = Grey, fontSize = 12.sp)
        }
        Text("${f.homeTeam} v ${f.awayTeam}", fontWeight = FontWeight.Bold, fontSize = 15.sp, modifier = Modifier.padding(top = 4.dp))
        val (txt, c) = when (f.analysisStatus) {
            "analysed" -> if ((f.qualified ?: 0) > 0) "${f.qualified} qualified selection(s)" to Green else "Analysed, nothing qualified (${f.candidates ?: 0} candidates checked)" to Grey
            "no_odds" -> "No bookmaker odds found: not recommended" to Amber
            "skipped" -> (f.analysisNote ?: "Skipped: not enough data") to Amber
            else -> (f.analysisNote ?: "Waiting for analysis") to Grey
        }
        Text(txt + if (f.isDemo == true) "  ·  DEMO" else "", color = c, fontSize = 12.sp, modifier = Modifier.padding(top = 4.dp))
    }
}

@Composable
fun PicksScreen(s: UiState, onPick: (PickDto) -> Unit) {
    var tab by rememberSaveable { mutableStateOf(0) }
    val all = s.picks.filter { upcoming(it) }.sortedByDescending { it.score ?: 0.0 }
    val green = all.filter { it.grade == "GREEN" }; val amber = all.filter { it.grade == "AMBER" }
    Column {
        StatusBanners(s)
        TabRow(selectedTabIndex = tab, containerColor = Navy, contentColor = Green) {
            Tab(selected = tab == 0, onClick = { tab = 0 }, text = { Text("GREEN (${green.size})") })
            Tab(selected = tab == 1, onClick = { tab = 1 }, text = { Text("AMBER (${amber.size})") })
        }
        Spacer(Modifier.height(8.dp))
        if (tab == 1) Banner("AMBER selections show potential value but with notable uncertainty (limited data, models disagreeing, or value that disappears under a conservative estimate). Explore them with extra caution.")
        val list = if (tab == 0) green else amber
        if (list.isEmpty()) EmptyState(
            if (tab == 0) "No qualified selections today" else "No AMBER selections",
            "Putter never generates picks just to fill the page. Check back after the next refresh.",
        )
        val today = list.filter { isToday(parseTime(it.kickoff)) }
        val later = list.filter { !isToday(parseTime(it.kickoff)) }
        if (today.isNotEmpty()) { SectionTitle("Today"); today.forEach { PickCard(it) { onPick(it) } } }
        if (later.isNotEmpty()) { SectionTitle("Upcoming days"); later.forEach { PickCard(it) { onPick(it) } } }
    }
}

@Composable
fun PickDetail(p: PickDto, onBack: () -> Unit) {
    BackHandler(onBack = onBack)
    Column(Modifier.verticalScroll(rememberScrollState()).padding(16.dp)) {
        IconButton(onClick = onBack) { Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back") }
        PickCard(p) {}
        SectionTitle("Why this selection")
        Text(p.explanation ?: "", fontSize = 14.sp)
        SectionTitle("Probability and price")
        AppCard {
            RowLine("Model probability", pct(p.pModel))
            RowLine("Blended probability (after market cross-check)", pct(p.pAdj))
            RowLine("Bookmaker implied probability", pct(p.impliedProb))
            RowLine("Expected value per unit", p.ev?.let { signed(it * 100) + "%" } ?: "–", if ((p.ev ?: 0.0) > 0) Green else Red)
            RowLine("Data quality", pct(p.quality))
            RowLine("Published odds", f2(p.odds))
            p.latestOdds?.let { RowLine("Latest odds seen", f2(it)) }
            p.closingOdds?.let { RowLine("Closing odds", f2(it)) }
            RowLine("Bookmaker", p.bookmaker ?: "–")
            RowLine("Odds last updated", p.oddsUpdated?.let { fmtDayTime(parseTime(it)) } ?: "–")
            RowLine("Published", p.publishedAt?.let { fmtDayTime(parseTime(it)) } ?: "–")
        }
        if (!p.keyPlayers.isNullOrEmpty()) { SectionTitle("Important player information"); BulletList(p.keyPlayers) }
        SectionTitle("Supporting factors"); BulletList(p.factors)
        SectionTitle("Potential risks"); if (p.risks.isNullOrEmpty()) Text("No specific risks flagged beyond normal variance.", color = Grey, fontSize = 13.sp) else BulletList(p.risks, Amber)
        if (p.result != "PENDING") {
            SectionTitle("Result")
            Text("${p.result}  (${p.homeGoals ?: "?"}-${p.awayGoals ?: "?"})", color = if (p.result == "WON") Green else if (p.result == "LOST") Red else Grey, fontWeight = FontWeight.Bold)
        }
        Text("Not a guaranteed outcome. Never stake money you cannot afford to lose.", color = Grey, fontSize = 11.sp, modifier = Modifier.padding(vertical = 20.dp))
    }
}

@Composable
fun FixturesScreen(s: UiState) {
    Column {
        StatusBanners(s)
        val list = s.fixtures.filter { parseTime(it.kickoff) > now() - 3 * 3600_000 }
        if (list.isEmpty()) EmptyState("No fixtures loaded", "Pull fixtures with the refresh button. If this persists, check Profile for server status.")
        list.groupBy { fmtDay(parseTime(it.kickoff)) }.forEach { (day, fx) ->
            SectionTitle(day); fx.forEach { FixtureRow(it) }
        }
    }
}

@Composable
fun AnalysisScreen(s: UiState) {
    var sel by rememberSaveable { mutableStateOf<String?>(null) }
    val list = s.fixtures.filter { it.analysisStatus == "analysed" && it.expHome != null }
    Column {
        StatusBanners(s)
        Text("Each analysed match blends three models (form-based Poisson, goal-difference rating, Monte Carlo) and cross-checks them against de-vigged bookmaker prices.", color = Grey, fontSize = 12.sp)
        if (list.isEmpty()) EmptyState("No analysed matches yet", "Matches appear here once the server has fetched odds and form data for them.")
        list.forEach { f ->
            AppCard(onClick = { sel = if (sel == f.id) null else f.id }) {
                Text("${f.homeTeam} v ${f.awayTeam}", fontWeight = FontWeight.Bold)
                Text("${f.league} · ${fmtDayTime(parseTime(f.kickoff))}", color = Grey, fontSize = 12.sp)
                Row(Modifier.fillMaxWidth().padding(top = 8.dp), horizontalArrangement = Arrangement.SpaceBetween) {
                    Stat("Expected goals", "${f2(f.expHome ?: 0.0)} - ${f2(f.expAway ?: 0.0)}")
                    Stat("Data quality", pct(f.quality))
                    Stat("Qualified", "${f.qualified ?: 0}/${f.candidates ?: 0}", if ((f.qualified ?: 0) > 0) Green else White)
                }
                if (sel == f.id) {
                    val m = poissonMatrix(f.expHome ?: 1.4, f.expAway ?: 1.1)
                    Spacer(Modifier.height(10.dp))
                    Text("MODEL VIEW (single Poisson approximation of the blended expectation)", color = Grey, fontSize = 10.sp)
                    ProbBar("${f.homeTeam} win", probOf(m, "1X2:H")); ProbBar("Draw", probOf(m, "1X2:D")); ProbBar("${f.awayTeam} win", probOf(m, "1X2:A"))
                    ProbBar("Over 1.5 goals", probOf(m, "OU:1.5:O")); ProbBar("Over 2.5 goals", probOf(m, "OU:2.5:O")); ProbBar("Over 3.5 goals", probOf(m, "OU:3.5:O"))
                    ProbBar("Both teams to score", probOf(m, "BTTS:Y"))
                    Text("These are model probabilities, not odds. A price is only recommended when it beats the model after the market cross-check.", color = Grey, fontSize = 11.sp, modifier = Modifier.padding(top = 6.dp))
                }
            }
        }
    }
}
