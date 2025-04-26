
import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import express from "express";
import { z } from "zod";
import { fetchRaydiumMintList, getRecommendedRaydiumPools, getRaydiumPoolById, fetchRaydiumPools, RaydiumPool } from "./raydium-pools";
import { simulateLiquidityHandler } from "./simulate-liquidity";
import nodemailer from 'nodemailer';
import cron from 'node-cron';
import { WebSocketServer } from 'ws';
import {  Prisma } from '@prisma/client';
import { 
  EmailNotificationPreference, 
  saveEmailPreference, 
  sendDailyDeFiTips, 
  initializeEmailSchedules,
  generateDeFiTips,
  generateMarketAnalysis
} from './email-service';

import { prisma } from '../prisma/db';

// Schema for email notifications
const emailNotificationSchema = z.object({
  email: z.string().email(),
  notifications: z.boolean().default(true),
});

// Schema for liquidity transaction requests
const liquidityRequestSchema = z.object({
  wallet: z.string(),
  poolId: z.string().optional(),
  tokenA: z.string(),
  tokenB: z.string(),
  riskLevel: z.number().min(1).max(15),
  amount: z.number().positive(),
  slippage: z.number().min(0.1).max(100).optional(),
});

// Schema for transaction simulation
const simulateTransactionSchema = z.object({
  wallet: z.string(),
  riskLevel: z.number().min(1).max(15),
});

// Schema for detailed email notifications
const emailNotificationDetailSchema = z.object({
  email: z.string().email(),
  username: z.string().optional(),
  schedule: z.enum(['daily', 'weekly', 'realtime']),
  riskLevel: z.number().min(1).max(15),
  userWallet: z.string().optional(),
  topicPreferences: z.array(z.string()).optional(),
  notifications: z.boolean().default(true),
  protocol: z.string().optional()
});

// Schema for chat message
const chatMessageSchema = z.object({
  user_public_key: z.string(),
  content: z.string(),
  chatId: z.number().optional()
});

export async function registerRoutes(app: Express): Promise<Server> {
  // Initialize email schedules when the server starts
  initializeEmailSchedules();

  // API endpoint for setting up email notifications (basic)
  app.post("/api/notifications/email", async (req: Request, res: Response) => {
    try {
      const validatedData = emailNotificationSchema.parse(req.body);
      
      // Ensure user exists
      const user = await prisma.user.findUnique({
        where: { email: validatedData.email }
      });
      if (!user) {
        return res.status(400).json({
          success: false,
          message: "User with this email does not exist. Please register first."
        });
      }

      // Save to Prisma database
      const saved = await prisma.emailNotification.create({
        data: {
          email: validatedData.email,
          notificationsEnabled: validatedData.notifications,
          userId: user.id
        }
      });
      
      res.status(200).json({
        success: true,
        message: "Email notification preferences saved",
        data: saved
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
          return res.status(400).json({
            success: false,
            message: "Email notification with this email already exists"
          });
        }
      }
      console.error("Error setting up email notifications:", error);
      res.status(400).json({ 
        error: "Invalid email notification data", 
        message: error instanceof Error ? error.message : "Unknown error" 
      });
    }
  });

  // API endpoint for setting up detailed email notifications
  app.post("/api/notifications/email/detailed", async (req: Request, res: Response) => {
    try {
      const validatedData = emailNotificationDetailSchema.parse(req.body);
      
      console.log("Validated data:", validatedData);
      if (!validatedData.userWallet) {
        return res.status(400).json({ 
          error: "Missing wallet address",
          message: "Please connect your wallet first"
        });
      }

      let user = await prisma.user.findUnique({
        where: { publicKey: validatedData.userWallet }
      });
      if (!user) {
        console.log(`User with publicKey ${validatedData.userWallet} not found. Creating new user.`);
        user = await prisma.user.create({
          data: {
            publicKey: validatedData.userWallet,
            username: validatedData.username || `user-${Date.now()}`, // Fallback username
            email: validatedData.email // Use provided email
          }
        });
        console.log(`Created new user with ID ${user.id}`);
      }

      // Save to Prisma database
      const saved = await prisma.emailNotification.create({
        data: {
          email: validatedData.email,
          schedule: validatedData.schedule,
          riskLevel: validatedData.riskLevel,
          userWallet: validatedData.userWallet,
          notificationsEnabled: validatedData.notifications,
          topicPreferences: validatedData.topicPreferences || [],
          userId: user.id
        }
      });
      
      await initializeEmailSchedules();
      
      res.status(200).json({
        success: true,
        message: "Email notification preferences saved",
        preferences: {
          id: saved.id,
          email: validatedData.email,
          schedule: validatedData.schedule,
          riskLevel: validatedData.riskLevel,
          userWallet: validatedData.userWallet
        }
      });
    } catch (error) {
      console.error("Error setting up detailed email notifications:", error);
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
          return res.status(400).json({
            success: false,
            message: "Email notification with this email already exists"
          });
        }
      }
      console.error("Error setting up detailed email notifications:", error);
      res.status(400).json({ 
        error: "Invalid email notification data", 
        message: error instanceof Error ? error.message : "Unknown error" 
      });
    }
  });

  // API endpoint to list email preferences for a user
  app.get("/api/notifications/email/list", async (req: Request, res: Response) => {
    try {
      const userWallet = req.query.userWallet as string;
      if (!userWallet) {
        return res.status(400).json({
          success: false,
          message: "userWallet query parameter is required"
        });
      }

      const preferences = await prisma.emailNotification.findMany({
        where: { userWallet },
        select: {
          id: true,
          email: true,
          schedule: true,
          riskLevel: true,
          notificationsEnabled: true,
          topicPreferences: true,
          username: true
        }
      });

      res.status(200).json({
        success: true,
        preferences
      });
    } catch (error) {
      console.error("Error listing email preferences:", error);
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : "Internal server error"
      });
    }
  });

  // API endpoint to list all chats for a user
  app.get("/api/chat/list", async (req: Request, res: Response) => {
    try {
      const userWallet = req.query.userWallet as string;
      if (!userWallet) {
        return res.status(400).json({
          success: false,
          message: "userWallet query parameter is required"
        });
      }

      const chats = await prisma.chat.findMany({
        where: { userPublicKey: userWallet },
        select: {
          id: true,
          title: true,
          createdAt: true
        },
        orderBy: { createdAt: 'desc' }
      });

      res.status(200).json({
        success: true,
        chats
      });
    } catch (error) {
      console.error("Error listing chats:", error);
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : "Internal server error"
      });
    }
  });

  // API endpoint to get all messages for a specific chat
  app.get("/api/chat/messages/:chatId", async (req: Request, res: Response) => {
    try {
      const chatId = parseInt(req.params.chatId);
      if (isNaN(chatId)) {
        return res.status(400).json({
          success: false,
          message: "Invalid chatId"
        });
      }

      const userWallet = req.query.userWallet as string;
      if (!userWallet) {
        return res.status(400).json({
          success: false,
          message: "userWallet query parameter is required"
        });
      }

      // Verify the chat exists and belongs to the user
      const chat = await prisma.chat.findUnique({
        where: { id: chatId }
      });
      if (!chat || chat.userPublicKey !== userWallet) {
        return res.status(404).json({
          success: false,
          message: "Chat not found or not associated with this user"
        });
      }

      // Fetch all messages for the chat
      const messages = await prisma.message.findMany({
        where: { chatId },
        select: {
          id: true,
          chatId: true,
          userPublicKey: true,
          content: true,
          sentAt: true,
        },
        orderBy: { sentAt: 'asc' }
      });

      res.status(200).json({
        success: true,
        messages
      });
    } catch (error) {
      console.error("Error fetching chat messages:", error);
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : "Internal server error"
      });
    }
  });

  // API endpoint to save chat messages
  app.post("/api/chat/message", async (req: Request, res: Response) => {
    try {
      const validatedData = chatMessageSchema.parse(req.body);

      // Ensure the user exists
      const user = await prisma.user.findUnique({
        where: { publicKey: validatedData.user_public_key }
      });
      if (!user) {
        return res.status(400).json({
          success: false,
          message: "User with provided public key does not exist. Please register first."
        });
      }

      // Find or create chat
      let chat = await prisma.chat.findFirst({
        where: {
          userPublicKey: validatedData.user_public_key
        },
        orderBy: {
          createdAt: 'desc'
        }
      });

      if (!chat || validatedData.chatId) {
        if (validatedData.chatId) {
          chat = await prisma.chat.findUnique({
            where: { id: validatedData.chatId }
          });
          if (!chat) {
            return res.status(400).json({
              success: false,
              message: "Chat with provided ID does not exist"
            });
          }
        } else {
          chat = await prisma.chat.create({
            data: {
              userPublicKey: validatedData.user_public_key,
              title: "New Chat"
            }
          });
        }
      }

      // Create message
      const message = await prisma.message.create({
        data: {
          chatId: chat.id,
          userPublicKey: validatedData.user_public_key,
          content: validatedData.content
        }
      });

      res.status(200).json({ 
        success: true,
        message: "Message saved successfully",
        data: message
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2025') {
          return res.status(400).json({
            success: false,
            message: "Related record (user or chat) not found"
          });
        }
      }
      console.error("Failed to save chat message:", error);
      res.status(500).json({ 
        success: false, 
        message: error instanceof Error ? error.message : "Internal server error"
      });
    }
  });

  // API endpoint for triggering an immediate email notification
  app.post("/api/notifications/email/send-now", async (req: Request, res: Response) => {
    try {
      const validatedData = emailNotificationDetailSchema.parse(req.body);
      
      const success = await sendDailyDeFiTips(validatedData);
      
      res.status(success ? 200 : 500).json({
        success,
        message: success ? "Email sent successfully" : "Failed to send email"
      });
    } catch (error) {
      console.error("Error sending immediate email:", error);
      res.status(400).json({ 
        error: "Failed to send email", 
        message: error instanceof Error ? error.message : "Unknown error" 
      });
    }
  });

  // Genilana Raydium endpoints
  // Mint list endpoint
  app.get("/api/raydium/mintlist", async (_req: Request, res: Response) => {
    try {
      const mintList = await fetchRaydiumMintList();
      res.status(200).json({ success: true, mintList });
    } catch (error) {
      res.status(500).json({ 
        success: false, 
        error: error instanceof Error ? error.message : "Unknown error" 
      });
    }
  });

  // Flexible Raydium pool search
  app.get("/api/raydium/pools/search", async (req: Request, res: Response) => {
    try {
      const { poolId } = req.query;
      if (poolId) {
        const pool = await getRaydiumPoolById(poolId as string);
        return res.json({ pools: pool ? [pool] : [] });
      }

      const sortField = req.query.sortField as string | undefined;
      const sortOrder = (req.query.sortOrder as string) === 'asc' ? 'asc' : 'desc';
      const tokenSymbols = req.query.tokenSymbols ? (req.query.tokenSymbols as string).split(',').map(s => s.trim().toUpperCase()) : undefined;
      const riskLevel = req.query.riskLevel ? parseInt(req.query.riskLevel as string) : undefined;

      let pools = await fetchRaydiumPools();
      
      if (tokenSymbols && tokenSymbols.length > 0) {
        pools = pools.filter((p: RaydiumPool) => 
          tokenSymbols.includes(p.token1Symbol.toUpperCase()) || 
          tokenSymbols.includes(p.token2Symbol.toUpperCase())
        );
      }

      if (riskLevel !== undefined) {
        let tvlThreshold = 0;
        if (riskLevel <= 3) tvlThreshold = 100000;
        else if (riskLevel <= 6) tvlThreshold = 50000;
        else if (riskLevel <= 10) tvlThreshold = 10000;
        pools = pools.filter((p: RaydiumPool) => p.tvl >= tvlThreshold);
      }

      if (sortField && ['apr', 'tvl', 'volume24h'].includes(sortField)) {
        pools = pools.sort((a: RaydiumPool, b: RaydiumPool) => {
          let aVal: number = 0;
          let bVal: number = 0;
          if (sortField === 'apr') {
            aVal = a.apr ?? 0;
            bVal = b.apr ?? 0;
          } else if (sortField === 'tvl') {
            aVal = a.tvl ?? 0;
            bVal = b.tvl ?? 0;
          } else if (sortField === 'volume24h') {
            aVal = a.volume24h ?? 0;
            bVal = b.volume24h ?? 0;
          }
          return sortOrder === 'asc' ? aVal - bVal : bVal - aVal;
        });
      }

      res.json({ pools });
    } catch (error) {
      res.status(500).json({ 
        error: error instanceof Error ? error.message : "Failed to search Raydium pools" 
      });
    }
  });

  // Recommended pools endpoint
  app.get("/api/raydium/pools/recommended", async (req: Request, res: Response) => {
    try {
      const limit = parseInt(req.query.limit as string) || 5;
      const offset = parseInt(req.query.offset as string) || 0;
      const pools = await getRecommendedRaydiumPools({ limit, offset });
      res.json({ pools });
    } catch (error) {
      res.status(500).json({ 
        error: error instanceof Error ? error.message : "Failed to fetch Raydium pools" 
      });
    }
  });

  // API endpoint for generating DeFi tips
  app.get("/api/defi/tips", async (req: Request, res: Response) => {
    try {
      const riskLevel = parseInt(req.query.riskLevel as string) || 5;
      const pools = await getRecommendedRaydiumPools({ limit: 5 });
      
      const tips = await generateDeFiTips(riskLevel, pools);
      
      res.status(200).json({ 
        tips,
        riskLevel
      });
    } catch (error) {
      console.error("Error generating DeFi tips:", error);
      res.status(500).json({ 
        error: "Failed to generate DeFi tips", 
        message: error instanceof Error ? error.message : "Unknown error" 
      });
    }
  });

  // API endpoint for generating market analysis
  app.get("/api/defi/market-analysis", async (req: Request, res: Response) => {
    try {
      const riskLevel = parseInt(req.query.riskLevel as string) || 5;
      const analysis = await generateMarketAnalysis(riskLevel);
      
      res.status(200).json({ 
        analysis,
        riskLevel
      });
    } catch (error) {
      console.error("Error generating market analysis:", error);
      res.status(500).json({ 
        error: "Failed to generate market analysis", 
        message: error instanceof Error ? error.message : "Unknown error" 
      });
    }
  });

  // Prepare Raydium liquidity transaction endpoint
  app.post("/api/raydium/prepare-liquidity", express.json(), async (req: Request, res: Response) => {
    try {
      const parsed = liquidityRequestSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ 
          success: false, 
          error: "Invalid request", 
          details: parsed.error.errors 
        });
      }

      const { wallet, poolId, tokenA, tokenB, riskLevel, amount, slippage = 1 } = parsed.data;
      if (!poolId) {
        throw new Error("poolId is required for Raydium add liquidity");
      }

      // Ensure the user exists
      const user = await prisma.user.findUnique({
        where: { publicKey: wallet }
      });
      if (!user) {
        return res.status(400).json({
          success: false,
          message: "User with provided public key does not exist. Please register first."
        });
      }

      const { addLiquidityToPool } = await import("./raydium");
      const result = await addLiquidityToPool({ 
        wallet, 
        poolId, 
        tokenA, 
        tokenB, 
        riskLevel, 
        amount,
        slippage
      });
      
      const RPC_URL = process.env.SOLANA_RPC_URL || "https://api.devnet.solana.com";
      
      // Save transaction to database
      await prisma.transaction.create({
        data: {
          userPublicKey: wallet,
          transactionData: {
            transaction: result.transaction,
            expectedAmount: result.anotherAmount,
            transactionType: result.transactionType,
            missingAccounts: result.missingAccounts,
            nextStep: result.nextStep
          }
        }
      });

      return res.json({ 
        success: true, 
        transaction: result.transaction, 
        expectedAmount: result.anotherAmount,
        transactionType: result.transactionType,
        missingAccounts: result.missingAccounts,
        nextStep: result.nextStep,
        rpcUrl: RPC_URL 
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2025') {
          return res.status(400).json({
            success: false,
            message: "Related record (user) not found"
          });
        }
      }
      console.error("Error in prepare-liquidity:", error);
      return res.status(500).json({ 
        success: false, 
        error: error instanceof Error ? error.message : "Internal server error"
      });
    }
  });

  app.post("/api/raydium/simulate", express.json(), simulateLiquidityHandler);

  // Setup websocket server for live updates
  const httpServer = createServer(app);
  const wss = new WebSocketServer({ 
    server: httpServer, 
    path: '/ws',
    verifyClient: (info, cb) => {
      cb(true);
    }
  });
  
  // Handle websocket connections
  wss.on('connection', (ws: any) => {
    console.log('Client connected to websocket');
    
    ws.send(JSON.stringify({
      type: 'welcome',
      message: 'Connected to Meteora AI Agent websocket server'
    }));
    
    ws.on('message', (message: any) => {
      try {
        const data = JSON.parse(message.toString());
        console.log('Received message:', data);
        
        if (data.type === 'subscribe') {
          ws.send(JSON.stringify({
            type: 'subscription_confirmed',
            topic: data.topic,
            message: `Subscribed to ${data.topic}`
          }));
        }
      } catch (error) {
        console.error('Error handling websocket message:', error);
        ws.send(JSON.stringify({
          type: 'error',
          message: 'Failed to process message'
        }));
      }
    });
    
    ws.on('close', () => {
      console.log('Client disconnected from websocket');
    });
  });
  
  return httpServer;
}