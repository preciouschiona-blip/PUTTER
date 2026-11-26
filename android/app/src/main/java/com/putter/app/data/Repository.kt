package com.putter.app.data

import android.content.Context
import androidx.room.withTransaction
import com.google.gson.Gson
import com.putter.app.domain.parseTime
import java.time.Instant

class Repository(context: Context) {
    private val db = PutterDb.get(context)
    private val dao = db.dao()
    private val gson = Gson()

    val picksFlow = dao.picks()
    val fixturesFlow = dao.fixtures()
    val ticketsFlow = dao.tickets()
    val metaFlow = dao.meta()

    fun pick(e: PickEntity): PickDto = gson.fromJson(e.json, PickDto::class.java)
    fun ticket(e: TicketEntity): TicketDto = gson.fromJson(e.json, TicketDto::class.java)
    fun fixture(e: FixtureEntity): FixtureDto = gson.fromJson(e.json, FixtureDto::class.java)
    fun <T> fromJson(json: String, cls: Class<T>): T? = runCatching { gson.fromJson(json, cls) }.getOrNull()

    /** Downloads the latest data and replaces the local cache. On failure the cache is left untouched (offline mode). */
    suspend fun refresh(): Result<Unit> = runCatching {
        check(Network.configured) { "App not configured: Supabase URL/key were not set when this APK was built." }
        val api = Network.api
        val picks = api.picks()
        val since = Instant.now().minusSeconds(86_400).toString()
        val fixtures = api.fixtures(kickoff = "gte.$since")
        val tickets = runCatching { api.tickets() }.getOrNull()
        val run = runCatching { api.runs().firstOrNull() }.getOrNull()
        val config = runCatching { api.config() }.getOrNull()
        db.withTransaction {
            dao.clearPicks(); dao.insertPicks(picks.map { PickEntity(it.id, parseTime(it.kickoff), gson.toJson(it)) })
            dao.clearFixtures(); dao.insertFixtures(fixtures.map { FixtureEntity(it.id, parseTime(it.kickoff), gson.toJson(it)) })
            if (tickets != null) { dao.clearTickets(); dao.insertTickets(tickets.map { TicketEntity(it.id, parseTime(it.firstKickoff), gson.toJson(it)) }) }
            dao.putMeta(MetaEntity("lastSync", System.currentTimeMillis().toString()))
            if (run != null) dao.putMeta(MetaEntity("lastRun", gson.toJson(run)))
            if (config != null) dao.putMeta(MetaEntity("config", gson.toJson(config)))
        }
    }

    suspend fun meta(key: String) = dao.metaValue(key)
    suspend fun setMeta(key: String, value: String) = dao.putMeta(MetaEntity(key, value))
}
