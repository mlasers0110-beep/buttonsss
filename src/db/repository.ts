import { and, desc, eq } from 'drizzle-orm';
import { db } from './index.ts';
import {
  driverCalibrations,
  hapticPatterns,
  mediaAssets,
  screenMaps,
  sourcePrompts,
  synthPresets,
  users,
} from './schema.ts';

export async function getOrCreateUser(uid: string, email: string, displayName?: string | null) {
  try {
    const result = await db
      .insert(users)
      .values({
        uid,
        email,
        displayName: displayName ?? null,
      })
      .onConflictDoUpdate({
        target: users.uid,
        set: {
          email,
          displayName: displayName ?? null,
        },
      })
      .returning();
    return result[0];
  } catch (error) {
    console.error('Database query failed in getOrCreateUser:', error);
    throw new Error('Nie udało się zsynchronizować profilu użytkownika.', { cause: error });
  }
}

export async function listUserStudioData(uid: string) {
  try {
    const [presets, prompts, haptics, media, calibrations, maps] = await Promise.all([
      db
        .select()
        .from(synthPresets)
        .where(eq(synthPresets.userUid, uid))
        .orderBy(desc(synthPresets.createdAt)),
      db
        .select()
        .from(sourcePrompts)
        .where(eq(sourcePrompts.userUid, uid))
        .orderBy(desc(sourcePrompts.createdAt)),
      db
        .select()
        .from(hapticPatterns)
        .where(eq(hapticPatterns.userUid, uid))
        .orderBy(desc(hapticPatterns.createdAt)),
      db
        .select()
        .from(mediaAssets)
        .where(eq(mediaAssets.userUid, uid))
        .orderBy(desc(mediaAssets.createdAt)),
      db
        .select()
        .from(driverCalibrations)
        .where(eq(driverCalibrations.userUid, uid))
        .orderBy(desc(driverCalibrations.createdAt)),
      db
        .select()
        .from(screenMaps)
        .where(eq(screenMaps.userUid, uid))
        .orderBy(desc(screenMaps.createdAt)),
    ]);

    return { presets, prompts, haptics, media, calibrations, screenMaps: maps };
  } catch (error) {
    console.error('Database query failed in listUserStudioData:', error);
    throw new Error('Nie udało się pobrać bibliotek użytkownika.', { cause: error });
  }
}

export async function createSynthPresetRecord(
  uid: string,
  name: string,
  materialType: string,
  configJson: string
) {
  try {
    const [row] = await db
      .insert(synthPresets)
      .values({ userUid: uid, name, materialType, configJson })
      .returning();
    return row;
  } catch (error) {
    console.error('Database query failed in createSynthPresetRecord:', error);
    throw new Error('Nie udało się zapisać presetu syntezatora.', { cause: error });
  }
}

export async function deleteSynthPresetRecord(uid: string, id: number) {
  try {
    await db
      .delete(synthPresets)
      .where(and(eq(synthPresets.id, id), eq(synthPresets.userUid, uid)));
  } catch (error) {
    console.error('Database query failed in deleteSynthPresetRecord:', error);
    throw new Error('Nie udało się usunąć presetu syntezatora.', { cause: error });
  }
}

export async function createSourcePromptRecord(
  uid: string,
  title: string,
  category: string,
  promptText: string,
  sourceConfigJson: string
) {
  try {
    const [row] = await db
      .insert(sourcePrompts)
      .values({ userUid: uid, title, category, promptText, sourceConfigJson })
      .returning();
    return row;
  } catch (error) {
    console.error('Database query failed in createSourcePromptRecord:', error);
    throw new Error('Nie udało się zapisać konfiguracji sorsa.', { cause: error });
  }
}

export async function deleteSourcePromptRecord(uid: string, id: number) {
  try {
    await db
      .delete(sourcePrompts)
      .where(and(eq(sourcePrompts.id, id), eq(sourcePrompts.userUid, uid)));
  } catch (error) {
    console.error('Database query failed in deleteSourcePromptRecord:', error);
    throw new Error('Nie udało się usunąć konfiguracji sorsa.', { cause: error });
  }
}

export async function createHapticPatternRecord(
  uid: string,
  name: string,
  patternJson: string,
  hardness: number,
  reverseClutch: number
) {
  try {
    const [row] = await db
      .insert(hapticPatterns)
      .values({ userUid: uid, name, patternJson, hardness, reverseClutch })
      .returning();
    return row;
  } catch (error) {
    console.error('Database query failed in createHapticPatternRecord:', error);
    throw new Error('Nie udało się zapisać wzorca haptycznego.', { cause: error });
  }
}

export async function deleteHapticPatternRecord(uid: string, id: number) {
  try {
    await db
      .delete(hapticPatterns)
      .where(and(eq(hapticPatterns.id, id), eq(hapticPatterns.userUid, uid)));
  } catch (error) {
    console.error('Database query failed in deleteHapticPatternRecord:', error);
    throw new Error('Nie udało się usunąć wzorca haptycznego.', { cause: error });
  }
}

export async function createMediaAssetRecord(
  uid: string,
  title: string,
  mediaType: string,
  aspectRatio: string,
  resolution: string,
  prompt: string,
  dataUrl: string
) {
  try {
    const [row] = await db
      .insert(mediaAssets)
      .values({ userUid: uid, title, mediaType, aspectRatio, resolution, prompt, dataUrl })
      .returning();
    return row;
  } catch (error) {
    console.error('Database query failed in createMediaAssetRecord:', error);
    throw new Error('Nie udało się zapisać wygenerowanego zasobu.', { cause: error });
  }
}

export async function deleteMediaAssetRecord(uid: string, id: number) {
  try {
    await db
      .delete(mediaAssets)
      .where(and(eq(mediaAssets.id, id), eq(mediaAssets.userUid, uid)));
  } catch (error) {
    console.error('Database query failed in deleteMediaAssetRecord:', error);
    throw new Error('Nie udało się usunąć zasobu.', { cause: error });
  }
}

export async function createDriverCalibrationRecord(
  uid: string,
  name: string,
  controllerModel: string,
  calibrationJson: string
) {
  try {
    const [row] = await db
      .insert(driverCalibrations)
      .values({ userUid: uid, name, controllerModel, calibrationJson })
      .returning();
    return row;
  } catch (error) {
    console.error('Database query failed in createDriverCalibrationRecord:', error);
    throw new Error('Nie udało się zapisać profilu kalibracji sterownika.', { cause: error });
  }
}

export async function deleteDriverCalibrationRecord(uid: string, id: number) {
  try {
    await db
      .delete(driverCalibrations)
      .where(and(eq(driverCalibrations.id, id), eq(driverCalibrations.userUid, uid)));
  } catch (error) {
    console.error('Database query failed in deleteDriverCalibrationRecord:', error);
    throw new Error('Nie udało się usunąć profilu kalibracji sterownika.', { cause: error });
  }
}

export async function createScreenMapRecord(
  uid: string,
  name: string,
  sourceRepo: string,
  defaultTransition: string,
  mapJson: string
) {
  try {
    const [row] = await db
      .insert(screenMaps)
      .values({ userUid: uid, name, sourceRepo, defaultTransition, mapJson })
      .returning();
    return row;
  } catch (error) {
    console.error('Database query failed in createScreenMapRecord:', error);
    throw new Error('Nie udało się zapisać mapy ekranów w bazie danych.', { cause: error });
  }
}

export async function deleteScreenMapRecord(uid: string, id: number) {
  try {
    await db
      .delete(screenMaps)
      .where(and(eq(screenMaps.id, id), eq(screenMaps.userUid, uid)));
  } catch (error) {
    console.error('Database query failed in deleteScreenMapRecord:', error);
    throw new Error('Nie udało się usunąć mapy ekranów.', { cause: error });
  }
}


