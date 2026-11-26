package com.putter.app.data

import com.google.gson.annotations.SerializedName

data class PickDto(
    val id: String,
    @SerializedName("fixture_id") val fixtureId: String,
    val kickoff: String,
    val league: String,
    @SerializedName("home_team") val homeTeam: String,
    @SerializedName("away_team") val awayTeam: String,
    @SerializedName("market_id") val marketId: String,
    @SerializedName("market_label") val marketLabel: String,
    @SerializedName("selection_label") val selectionLabel: String,
    val odds: Double,
    val bookmaker: String?,
    @SerializedName("odds_updated") val oddsUpdated: String?,
    @SerializedName("p_model") val pModel: Double?,
    @SerializedName("p_adj") val pAdj: Double?,
    @SerializedName("implied_prob") val impliedProb: Double?,
    val ev: Double?,
    val confidence: Int?,
    val quality: Double?,
    val score: Double?,
    val grade: String,
    val explanation: String?,
    @SerializedName("key_players") val keyPlayers: List<String>?,
    val factors: List<String>?,
    val risks: List<String>?,
    @SerializedName("score_matrix") val scoreMatrix: List<List<Double>>?,
    @SerializedName("is_demo") val isDemo: Boolean?,
    @SerializedName("published_at") val publishedAt: String?,
    val result: String,
    val profit: Double?,
    @SerializedName("home_goals") val homeGoals: Int?,
    @SerializedName("away_goals") val awayGoals: Int?,
    @SerializedName("latest_odds") val latestOdds: Double?,
    @SerializedName("latest_odds_at") val latestOddsAt: String?,
    @SerializedName("closing_odds") val closingOdds: Double?,
)

data class FixtureDto(
    val id: String,
    val league: String,
    @SerializedName("home_team") val homeTeam: String,
    @SerializedName("away_team") val awayTeam: String,
    val kickoff: String,
    val status: String?,
    @SerializedName("home_goals") val homeGoals: Int?,
    @SerializedName("away_goals") val awayGoals: Int?,
    @SerializedName("analysis_status") val analysisStatus: String?,
    @SerializedName("analysis_note") val analysisNote: String?,
    val quality: Double?,
    @SerializedName("exp_home") val expHome: Double?,
    @SerializedName("exp_away") val expAway: Double?,
    val candidates: Int?,
    val qualified: Int?,
    @SerializedName("is_demo") val isDemo: Boolean?,
)

data class RunDto(
    val kind: String?,
    @SerializedName("started_at") val startedAt: String?,
    @SerializedName("finished_at") val finishedAt: String?,
    val ok: Boolean?,
    @SerializedName("fixtures_seen") val fixturesSeen: Int?,
    @SerializedName("fixtures_analysed") val fixturesAnalysed: Int?,
    @SerializedName("picks_published") val picksPublished: Int?,
    val message: String?,
)

data class ConfigRow(val key: String, val value: com.google.gson.JsonElement?)
