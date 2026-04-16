import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { TextToSpeechClient } from '@google-cloud/text-to-speech';

// Initialize Firebase Admin
admin.initializeApp();

// Initialize Google Cloud TTS client
const ttsClient = new TextToSpeechClient();

/**
 * Firestore trigger: Generate audio when a card is created or updated
 * Triggers on: /users/{userId}/cards/{cardId}
 */
export const generateCardAudio = functions.firestore
  .document('users/{userId}/cards/{cardId}')
  .onWrite(async (change, context) => {
    const { userId, cardId } = context.params;

    // Check if document was deleted
    if (!change.after.exists) {
      console.log(`Card ${cardId} was deleted, skipping audio generation`);
      return null;
    }

    const cardData = change.after.data();
    if (!cardData) {
      console.log('No card data found');
      return null;
    }

    const { japanese, audioUrl } = cardData;

    // Skip if no Japanese text
    if (!japanese || typeof japanese !== 'string') {
      console.log('No Japanese text found in card');
      return null;
    }

    // Skip if audio already exists and Japanese text hasn't changed
    if (audioUrl && change.before.exists) {
      const beforeData = change.before.data();
      if (beforeData?.japanese === japanese) {
        console.log('Japanese text unchanged and audio exists, skipping generation');
        return null;
      }
    }

    console.log(`Generating audio for card ${cardId}: "${japanese}"`);

    try {
      // Generate audio using Google Cloud TTS
      const [response] = await ttsClient.synthesizeSpeech({
        input: { text: japanese },
        voice: {
          languageCode: 'ja-JP',
          name: 'ja-JP-Neural2-B', // Female voice
          ssmlGender: 'FEMALE',
        },
        audioConfig: {
          audioEncoding: 'MP3',
          speakingRate: 0.9, // Slightly slower for learning
          pitch: 0,
        },
      });

      if (!response.audioContent) {
        throw new Error('No audio content returned from TTS');
      }

      // Upload to Cloud Storage
      const bucket = admin.storage().bucket();
      const fileName = `users/${userId}/audio/${cardId}.mp3`;
      const file = bucket.file(fileName);

      await file.save(Buffer.from(response.audioContent), {
        metadata: {
          contentType: 'audio/mpeg',
          metadata: {
            cardId,
            japanese,
            generatedAt: new Date().toISOString(),
          },
        },
      });

      // Make the file publicly readable
      await file.makePublic();

      // Get the public URL
      const publicUrl = `https://storage.googleapis.com/${bucket.name}/${fileName}`;

      console.log(`Audio uploaded to: ${publicUrl}`);

      // Update the card document with the audio URL
      await change.after.ref.update({
        audioUrl: publicUrl,
      });

      console.log(`Card ${cardId} updated with audio URL`);

      return { success: true, audioUrl: publicUrl };
    } catch (error) {
      console.error('Error generating audio:', error);

      // Don't throw - we don't want to fail the card creation if audio generation fails
      return { success: false, error: String(error) };
    }
  });
