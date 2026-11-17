import { relations } from 'drizzle-orm';
import { integer, pgTable, serial, text, timestamp } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  uid: text('uid').primaryKey(),
  email: text('email').notNull(),
  displayName: text('display_name'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const synthPresets = pgTable('synth_presets', {
  id: serial('id').primaryKey(),
  userUid: text('user_uid')
    .references(() => users.uid, { onDelete: 'cascade' })
    .notNull(),
  name: text('name').notNull(),
  materialType: text('material_type').notNull(),
  configJson: text('config_json').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const sourcePrompts = pgTable('source_prompts', {
  id: serial('id').primaryKey(),
  userUid: text('user_uid')
    .references(() => users.uid, { onDelete: 'cascade' })
    .notNull(),
  title: text('title').notNull(),
  category: text('category').notNull(),
  promptText: text('prompt_text').notNull(),
  sourceConfigJson: text('source_config_json').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const hapticPatterns = pgTable('haptic_patterns', {
  id: serial('id').primaryKey(),
  userUid: text('user_uid')
    .references(() => users.uid, { onDelete: 'cascade' })
    .notNull(),
  name: text('name').notNull(),
  patternJson: text('pattern_json').notNull(),
  hardness: integer('hardness').notNull(),
  reverseClutch: integer('reverse_clutch').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const mediaAssets = pgTable('media_assets', {
  id: serial('id').primaryKey(),
  userUid: text('user_uid')
    .references(() => users.uid, { onDelete: 'cascade' })
    .notNull(),
  title: text('title').notNull(),
  mediaType: text('media_type').notNull(),
  aspectRatio: text('aspect_ratio').notNull(),
  resolution: text('resolution').notNull(),
  prompt: text('prompt').notNull(),
  dataUrl: text('data_url').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const driverCalibrations = pgTable('driver_calibrations', {
  id: serial('id').primaryKey(),
  userUid: text('user_uid')
    .references(() => users.uid, { onDelete: 'cascade' })
    .notNull(),
  name: text('name').notNull(),
  controllerModel: text('controller_model').notNull(),
  calibrationJson: text('calibration_json').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const screenMaps = pgTable('screen_maps', {
  id: serial('id').primaryKey(),
  userUid: text('user_uid')
    .references(() => users.uid, { onDelete: 'cascade' })
    .notNull(),
  name: text('name').notNull(),
  sourceRepo: text('source_repo').notNull(),
  defaultTransition: text('default_transition').notNull(),
  mapJson: text('map_json').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const usersRelations = relations(users, ({ many }) => ({
  synthPresets: many(synthPresets),
  sourcePrompts: many(sourcePrompts),
  hapticPatterns: many(hapticPatterns),
  mediaAssets: many(mediaAssets),
  driverCalibrations: many(driverCalibrations),
  screenMaps: many(screenMaps),
}));

export const synthPresetsRelations = relations(synthPresets, ({ one }) => ({
  user: one(users, {
    fields: [synthPresets.userUid],
    references: [users.uid],
  }),
}));

export const sourcePromptsRelations = relations(sourcePrompts, ({ one }) => ({
  user: one(users, {
    fields: [sourcePrompts.userUid],
    references: [users.uid],
  }),
}));

export const hapticPatternsRelations = relations(hapticPatterns, ({ one }) => ({
  user: one(users, {
    fields: [hapticPatterns.userUid],
    references: [users.uid],
  }),
}));

export const mediaAssetsRelations = relations(mediaAssets, ({ one }) => ({
  user: one(users, {
    fields: [mediaAssets.userUid],
    references: [users.uid],
  }),
}));

export const driverCalibrationsRelations = relations(driverCalibrations, ({ one }) => ({
  user: one(users, {
    fields: [driverCalibrations.userUid],
    references: [users.uid],
  }),
}));

export const screenMapsRelations = relations(screenMaps, ({ one }) => ({
  user: one(users, {
    fields: [screenMaps.userUid],
    references: [users.uid],
  }),
}));


