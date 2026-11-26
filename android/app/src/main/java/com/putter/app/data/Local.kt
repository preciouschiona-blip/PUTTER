package com.putter.app.data

import android.content.Context
import androidx.room.Dao
import androidx.room.Database
import androidx.room.Entity
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.PrimaryKey
import androidx.room.Query
import androidx.room.Room
import androidx.room.RoomDatabase
import kotlinx.coroutines.flow.Flow

@Entity(tableName = "picks")
data class PickEntity(@PrimaryKey val id: String, val kickoffMs: Long, val json: String)

@Entity(tableName = "fixtures")
data class FixtureEntity(@PrimaryKey val id: String, val kickoffMs: Long, val json: String)

@Entity(tableName = "tickets")
data class TicketEntity(@PrimaryKey val id: String, val kickoffMs: Long, val json: String)

@Entity(tableName = "meta")
data class MetaEntity(@PrimaryKey val key: String, val value: String)

@Dao
interface PutterDao {
    @Query("SELECT * FROM picks ORDER BY kickoffMs DESC")
    fun picks(): Flow<List<PickEntity>>

    @Query("SELECT * FROM fixtures ORDER BY kickoffMs ASC")
    fun fixtures(): Flow<List<FixtureEntity>>

    @Query("SELECT * FROM tickets ORDER BY kickoffMs DESC")
    fun tickets(): Flow<List<TicketEntity>>

    @Query("DELETE FROM tickets")
    suspend fun clearTickets()

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertTickets(items: List<TicketEntity>)

    @Query("SELECT * FROM meta")
    fun meta(): Flow<List<MetaEntity>>

    @Query("SELECT value FROM meta WHERE key = :key")
    suspend fun metaValue(key: String): String?

    @Query("DELETE FROM picks")
    suspend fun clearPicks()

    @Query("DELETE FROM fixtures")
    suspend fun clearFixtures()

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertPicks(items: List<PickEntity>)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertFixtures(items: List<FixtureEntity>)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun putMeta(item: MetaEntity)
}

@Database(entities = [PickEntity::class, FixtureEntity::class, TicketEntity::class, MetaEntity::class], version = 2, exportSchema = false)
abstract class PutterDb : RoomDatabase() {
    abstract fun dao(): PutterDao

    companion object {
        @Volatile private var instance: PutterDb? = null
        fun get(context: Context): PutterDb = instance ?: synchronized(this) {
            instance ?: Room.databaseBuilder(context.applicationContext, PutterDb::class.java, "putter.db")
                .fallbackToDestructiveMigration().build().also { instance = it }
        }
    }
}
