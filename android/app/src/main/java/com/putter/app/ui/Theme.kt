package com.putter.app.ui

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

val Navy = Color(0xFF0B1220)
val Surface1 = Color(0xFF121B2E)
val CardBg = Color(0xFF18243B)
val Green = Color(0xFF00E676)
val Amber = Color(0xFFFFB300)
val Red = Color(0xFFFF5252)
val Grey = Color(0xFF8A97AD)
val White = Color(0xFFFFFFFF)

@Composable
fun PutterTheme(content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = darkColorScheme(
            primary = Green, onPrimary = Navy, secondary = White, onSecondary = Navy,
            background = Navy, onBackground = White, surface = Surface1, onSurface = White,
            surfaceVariant = CardBg, onSurfaceVariant = Grey, error = Red,
        ),
        content = content,
    )
}
