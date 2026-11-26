package com.putter.app

import android.Manifest
import android.os.Build
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.activity.viewModels
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.List
import androidx.compose.material.icons.filled.DateRange
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.filled.ShoppingCart
import androidx.compose.material.icons.filled.Star
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.putter.app.data.Network
import com.putter.app.domain.ago
import com.putter.app.ui.AccumulatorScreen
import com.putter.app.ui.AnalysisScreen
import com.putter.app.ui.Banner
import com.putter.app.ui.FixturesScreen
import com.putter.app.ui.Green
import com.putter.app.ui.Grey
import com.putter.app.ui.HomeScreen
import com.putter.app.ui.Navy
import com.putter.app.ui.PickDetail
import com.putter.app.ui.PicksScreen
import com.putter.app.ui.ProfileScreen
import com.putter.app.ui.PutterTheme
import com.putter.app.ui.ResultsScreen
import com.putter.app.ui.Surface1

private data class Tab(val label: String, val icon: ImageVector)

class MainActivity : ComponentActivity() {
    private val vm: MainViewModel by viewModels()
    private val notifPermission = registerForActivityResult(ActivityResultContracts.RequestPermission()) {}

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        if (Build.VERSION.SDK_INT >= 33) notifPermission.launch(Manifest.permission.POST_NOTIFICATIONS)
        setContent { PutterTheme { PutterRoot(vm) } }
    }
}

@Composable
private fun PutterRoot(vm: MainViewModel) {
    val state by vm.state.collectAsState()
    val loading by vm.loading.collectAsState()
    val error by vm.error.collectAsState()
    val tabs = listOf(
        Tab("Home", Icons.Filled.Home), Tab("Today's Picks", Icons.Filled.Star), Tab("Fixtures", Icons.Filled.DateRange),
        Tab("Analysis", Icons.Filled.Search), Tab("Accumulator", Icons.Filled.ShoppingCart),
        Tab("Results", Icons.AutoMirrored.Filled.List), Tab("Profile", Icons.Filled.Person),
    )
    var index by rememberSaveable { mutableStateOf(0) }
    var selected by remember { mutableStateOf<com.putter.app.data.PickDto?>(null) }

    Column(Modifier.fillMaxSize().background(Navy).statusBarsPadding().navigationBarsPadding()) {
        if (selected != null) {
            Box(Modifier.weight(1f)) { PickDetail(selected!!) { selected = null } }
        } else {
            Row(Modifier.fillMaxWidth().padding(start = 16.dp, end = 4.dp, top = 8.dp), verticalAlignment = Alignment.CenterVertically) {
                Column(Modifier.weight(1f)) {
                    Text("PUTTER", color = Green, fontWeight = FontWeight.ExtraBold, fontSize = 22.sp, letterSpacing = 3.sp)
                    Text("Updated ${ago(state.lastSyncMs)}", color = Grey, fontSize = 11.sp)
                }
                IconButton(onClick = { vm.refresh() }) { Icon(Icons.Filled.Refresh, contentDescription = "Refresh", tint = Green) }
            }
            if (loading) LinearProgressIndicator(Modifier.fillMaxWidth(), color = Green)
            Column(Modifier.weight(1f).verticalScroll(rememberScrollState()).padding(horizontal = 16.dp, vertical = 8.dp)) {
                if (!Network.configured) Banner("This build has no server configured, so no data can load. Rebuild with SUPABASE_URL and SUPABASE_ANON_KEY (see README).", com.putter.app.ui.Red)
                error?.let { Banner(it) }
                when (index) {
                    0 -> HomeScreen(state, { selected = it }, { index = it })
                    1 -> PicksScreen(state) { selected = it }
                    2 -> FixturesScreen(state)
                    3 -> AnalysisScreen(state)
                    4 -> AccumulatorScreen(state)
                    5 -> ResultsScreen(state) { selected = it }
                    else -> ProfileScreen(state, loading, error) { vm.refresh() }
                }
            }
            Row(Modifier.fillMaxWidth().background(Surface1).horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.Start) {
                tabs.forEachIndexed { i, t ->
                    val on = i == index
                    Column(Modifier.width(88.dp).clickable { index = i }.padding(vertical = 8.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                        Icon(t.icon, contentDescription = t.label, tint = if (on) Green else Grey)
                        Text(t.label, color = if (on) Green else Grey, fontSize = 10.sp, fontWeight = if (on) FontWeight.Bold else FontWeight.Normal, maxLines = 1)
                    }
                }
            }
        }
    }
}
