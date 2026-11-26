package com.putter.app

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.google.gson.Gson
import com.google.gson.JsonObject
import com.putter.app.data.ConfigRow
import com.putter.app.data.FixtureDto
import com.putter.app.data.PickDto
import com.putter.app.data.Repository
import com.putter.app.data.RunDto
import com.putter.app.data.TicketDto
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

data class UiState(
    val picks: List<PickDto> = emptyList(),
    val tickets: List<TicketDto> = emptyList(),
    val fixtures: List<FixtureDto> = emptyList(),
    val lastSyncMs: Long? = null,
    val lastRun: RunDto? = null,
    val settings: Map<String, String> = emptyMap(),
    val loaded: Boolean = false,
)

class MainViewModel(app: Application) : AndroidViewModel(app) {
    private val repo = Repository(app)
    val loading = MutableStateFlow(false)
    val error = MutableStateFlow<String?>(null)

    val state: StateFlow<UiState> = combine(repo.picksFlow, repo.fixturesFlow, repo.ticketsFlow, repo.metaFlow) { p, f, t, m ->
        val meta = m.associate { it.key to it.value }
        val cfg = meta["config"]?.let { json ->
            runCatching {
                val rows = Gson().fromJson(json, Array<ConfigRow>::class.java)
                rows.flatMap { r ->
                    val v = r.value
                    if (v != null && v.isJsonObject) (v as JsonObject).entrySet().map { it.key to it.value.toString().trim('"') }
                    else if (v != null) listOf(r.key to v.toString().take(80)) else emptyList()
                }.toMap()
            }.getOrNull()
        } ?: emptyMap()
        UiState(
            picks = p.map { repo.pick(it) }, tickets = t.map { repo.ticket(it) }, fixtures = f.map { repo.fixture(it) },
            lastSyncMs = meta["lastSync"]?.toLongOrNull(),
            lastRun = meta["lastRun"]?.let { repo.fromJson(it, RunDto::class.java) },
            settings = cfg, loaded = true,
        )
    }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), UiState())

    init { refresh() }

    fun refresh() {
        if (loading.value) return
        viewModelScope.launch {
            loading.value = true
            repo.refresh().onSuccess { error.value = null }.onFailure { e -> error.update { "Could not refresh: ${e.message}. Showing saved data." } }
            loading.value = false
        }
    }
}
