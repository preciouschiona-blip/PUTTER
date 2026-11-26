package com.putter.app.data

import com.putter.app.BuildConfig
import okhttp3.OkHttpClient
import okhttp3.Interceptor
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory
import retrofit2.http.GET
import retrofit2.http.Query
import java.util.concurrent.TimeUnit

interface SupabaseApi {
    @GET("rest/v1/picks")
    suspend fun picks(
        @Query("select") select: String = "*",
        @Query("order") order: String = "kickoff.desc",
        @Query("limit") limit: Int = 1000,
    ): List<PickDto>

    @GET("rest/v1/tickets")
    suspend fun tickets(
        @Query("select") select: String = "*",
        @Query("order") order: String = "ticket_date.desc,slot.asc",
        @Query("limit") limit: Int = 600,
    ): List<TicketDto>

    @GET("rest/v1/fixtures")
    suspend fun fixtures(
        @Query("select") select: String = "*",
        @Query("kickoff") kickoff: String,
        @Query("order") order: String = "kickoff.asc",
        @Query("limit") limit: Int = 500,
    ): List<FixtureDto>

    @GET("rest/v1/runs")
    suspend fun runs(
        @Query("select") select: String = "*",
        @Query("kind") kind: String = "eq.pipeline",
        @Query("order") order: String = "started_at.desc",
        @Query("limit") limit: Int = 1,
    ): List<RunDto>

    @GET("rest/v1/config")
    suspend fun config(@Query("select") select: String = "*"): List<ConfigRow>
}

object Network {
    val configured: Boolean get() = BuildConfig.SUPABASE_URL.isNotBlank() && BuildConfig.SUPABASE_ANON_KEY.isNotBlank()

    val api: SupabaseApi by lazy {
        val client = OkHttpClient.Builder()
            .connectTimeout(20, TimeUnit.SECONDS)
            .readTimeout(30, TimeUnit.SECONDS)
            .addInterceptor(Interceptor { chain ->
                chain.proceed(
                    chain.request().newBuilder()
                        .header("apikey", BuildConfig.SUPABASE_ANON_KEY)
                        .header("Authorization", "Bearer ${BuildConfig.SUPABASE_ANON_KEY}")
                        .build()
                )
            })
            .build()
        val base = BuildConfig.SUPABASE_URL.trimEnd('/') + "/"
        Retrofit.Builder().baseUrl(base).client(client)
            .addConverterFactory(GsonConverterFactory.create()).build()
            .create(SupabaseApi::class.java)
    }
}
