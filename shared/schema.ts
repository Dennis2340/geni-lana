import { pgTable, serial, text, integer, boolean, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  public_key: text("public_key").primaryKey(),
  username: text("username").unique(),
  created_at: text("created_at").notNull().default(new Date().toISOString()),
});

export const insertUserSchema = createInsertSchema(users).pick({
  public_key: true,
  username: true,
});

export const emailNotifications = pgTable("email_notifications", {
  id: serial("id").primaryKey(),
  user_public_key: text("user_public_key").references(() => users.public_key),
  email: text("email").notNull().unique(),
  username: text("username"),
  schedule: text("schedule").notNull().default("daily"),
  risk_level: integer("risk_level").notNull().default(5),
  notifications_enabled: boolean("notifications_enabled").default(true),
  user_wallet: text("user_wallet"),
  topic_preferences: jsonb("topic_preferences"),
  created_at: text("created_at").notNull().default(new Date().toISOString()),
});

export const insertEmailNotificationSchema = createInsertSchema(emailNotifications).pick({
  user_public_key: true,
  email: true,
  username: true,
  schedule: true,
  risk_level: true,
  notifications_enabled: true,
  user_wallet: true,
  topic_preferences: true,
});

export const chats = pgTable("chats", {
  id: serial("id").primaryKey(),
  user_public_key: text("user_public_key").references(() => users.public_key),
  title: text("title").notNull().default("New Chat"),
  created_at: text("created_at").notNull().default(new Date().toISOString()),
});

export const messages = pgTable("messages", {
  id: serial("id").primaryKey(),
  chat_id: integer("chat_id").references(() => chats.id),
  user_public_key: text("user_public_key").references(() => users.public_key),
  content: text("content").notNull(),
  sent_at: text("sent_at").notNull().default(new Date().toISOString()),
});

export const insertChatSchema = createInsertSchema(chats).pick({
  user_public_key: true,
  title: true,
});

export const insertMessageSchema = createInsertSchema(messages).pick({
  chat_id: true,
  user_public_key: true,
  content: true,
});

export const transactions = pgTable("transactions", {
  id: serial("id").primaryKey(),
  user_public_key: text("user_public_key").references(() => users.public_key),
  transaction_data: jsonb("transaction_data").notNull(),
  created_at: text("created_at").notNull().default(new Date().toISOString()),
});

export const insertTransactionSchema = createInsertSchema(transactions).pick({
  user_public_key: true,
  transaction_data: true,
});

export const liquidityPositions = pgTable("liquidity_positions", {
  id: serial("id").primaryKey(),
  user_public_key: text("user_public_key").references(() => users.public_key),
  position_data: jsonb("position_data").notNull(),
  risk_level: integer("risk_level").notNull(),
  created_at: text("created_at").notNull().default(new Date().toISOString()),
});

export const insertLiquidityPositionSchema = createInsertSchema(liquidityPositions).pick({
  user_public_key: true,
  position_data: true,
  risk_level: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export type InsertEmailNotification = z.infer<typeof insertEmailNotificationSchema>;
export type EmailNotification = typeof emailNotifications.$inferSelect;

export type InsertMessage = z.infer<typeof insertMessageSchema>;
export type Message = typeof messages.$inferSelect;

export type InsertTransaction = z.infer<typeof insertTransactionSchema>;
export type Transaction = typeof transactions.$inferSelect;

export type InsertLiquidityPosition = z.infer<typeof insertLiquidityPositionSchema>;
export type LiquidityPosition = typeof liquidityPositions.$inferSelect;
