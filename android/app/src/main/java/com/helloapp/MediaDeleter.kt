package com.helloapp

import android.content.ContentResolver
import android.net.Uri
import android.content.Context
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.Promise

class MediaDeleter(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {

    private val context: Context = reactContext

    override fun getName(): String {
        return "MediaDeleter"
    }

    @ReactMethod
    fun deleteMedia(uriString: String, promise: Promise) {
        try {
            val uri = Uri.parse(uriString)
            val contentResolver: ContentResolver = context.contentResolver
            val deletedRows = contentResolver.delete(uri, null, null)
            if (deletedRows > 0) {
                promise.resolve("Deleted")
            } else {
                promise.reject("NOT_FOUND", "Media not found")
            }
        } catch (e: Exception) {
            promise.reject("ERROR", e.message)
        }
    }
}