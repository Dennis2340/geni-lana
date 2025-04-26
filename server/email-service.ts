import { createTransport } from 'nodemailer';
import { PrismaClient } from '@prisma/client';
import "dotenv/config";
import OpenAI from 'openai';
import cron from 'node-cron';

const prisma = new PrismaClient();

// Initialize OpenAI 
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Email notification preferences interface
export interface EmailNotificationPreference {
  email: string;
  username?: string;
  schedule: 'daily' | 'weekly' | 'realtime';
  riskLevel: number;
  userWallet?: string;
  topicPreferences?: string[];
  notifications: boolean;
  protocol?: string; // Optional for OpenAI integration
}

// Configure Nodemailer transporter
const transporter = createTransport({
  service: 'gmail',
  auth: {
    user: 'kamaradennis36@gmail.com',
    pass: 'yxarahewlfdgkkwr',
  },
});

// Function to save or update email preferences in the database
export async function saveEmailPreference(preference: EmailNotificationPreference, userPublicKey: string): Promise<boolean> {
  try {
    const user = await prisma.user.findUnique({
      where: { publicKey: userPublicKey }
    });

    if (!user) {
      throw new Error('User not found');
    }

    const existing = await prisma.emailNotification.findUnique({
      where: { email: preference.email }
    });

    if (existing) {
      await prisma.emailNotification.update({
        where: { email: preference.email },
        data: {
          username: preference.username || null,
          schedule: preference.schedule,
          riskLevel: preference.riskLevel,
          userWallet: userPublicKey,
          topicPreferences: preference.topicPreferences,
          notificationsEnabled: preference.notifications
        }
      });
    } else {
      await prisma.emailNotification.create({
        data: {
          email: preference.email,
          username: preference.username || null,
          schedule: preference.schedule,
          riskLevel: preference.riskLevel,
          userWallet: userPublicKey,
          topicPreferences: preference.topicPreferences,
          notificationsEnabled: preference.notifications,
          user: { connect: { id: user.id } }
        }
      });
    }

    return true;
  } catch (error) {
    console.error('Error saving email preference:', error instanceof Error ? error.message : 'Unknown error');
    return false;
  }
}

// Function to send email notifications based on user preferences
export async function sendDailyDeFiTips(preference: EmailNotificationPreference): Promise<boolean> {
  try {
    // Validate required fields
    if (!preference.email || !preference.riskLevel) {
      throw new Error('Missing required fields: email or riskLevel');
    }

    const riskLevel = preference.riskLevel;
    let tipsContent = '';
    
    // Generate personalized DeFi tips using OpenAI
    const protocol = preference.protocol || 'Solana DeFi';
    const prompt = `Generate personalized ${protocol} tips for a user${preference.username ? ' named ' + preference.username : ''} with risk level ${riskLevel} (1 is lowest risk, 15 is highest risk). Provide 3 actionable tips focused on yield farming and liquidity pools. Format as HTML with a heading and unordered list.`;
    
    const completion = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
      max_tokens: 500
    });
    
    tipsContent = completion.choices[0].message.content || 'Unable to generate tips at this time.';
    
    // Send email
    await transporter.sendMail({
      from: 'kamaradennis36@gmail.com',
      to: preference.email,
      subject: 'Your Daily DeFi Tips',
      html: `
        <h2>Daily ${preference.protocol || 'DeFi'} Tips</h2>
        <p>${preference.username ? 'Hello ' + preference.username + '! Here' : 'Here'} are your personalized tips for today based on your risk level of ${riskLevel}:</p>
        ${tipsContent}
        <p>You can update your notification preferences at any time.</p>
        <p>Happy farming!</p>
      `,
    });
    
    console.log(`Sent DeFi tips to ${preference.email}`);
    return true;
  } catch (error) {
    console.error(`Error sending DeFi tips to ${preference.email}:`, error instanceof Error ? error.message : 'Unknown error');
    return false;
  }
}

// Function to generate DeFi tips based on risk level and pool data
export async function generateDeFiTips(riskLevel: number, pools: any[] = []): Promise<string[]> {
  try {
    let prompt = `Generate 3 concise DeFi tips for yield farming and liquidity pools based on a risk level of ${riskLevel} (1 is lowest risk, 15 is highest risk). Return just the tips as a JSON array of strings.`;
    
    if (pools.length > 0) {
      const poolDescriptions = pools.map(p => `${p.token1Symbol}/${p.token2Symbol} pool with ${p.apr}% APR and $${p.tvl} TVL`).join(', ');
      prompt += ` Consider these available pools: ${poolDescriptions}`;
    }
    
    const completion = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
      max_tokens: 300
    });
    
    const responseText = completion.choices[0].message.content || '[]';
    return JSON.parse(responseText);
  } catch (error) {
    console.error('Error generating DeFi tips:', error);
    return [
      'Consider diversifying your liquidity pool investments to mitigate risk.',
      'Monitor pool performance regularly to ensure optimal returns.',
      'Adjust your investment strategy based on market conditions and pool metrics.'
    ];
  }
}

// Function to generate market analysis based on risk level
export async function generateMarketAnalysis(riskLevel: number): Promise<string> {
  try {
    const prompt = `Generate a concise DeFi market analysis for a user with risk level ${riskLevel} (1 is lowest risk, 15 is highest risk). Format as HTML with a heading and 3 paragraphs summarizing key trends in yield farming and liquidity pools over the past week with recommendations. Total length should be ~150 words.`;
    
    const completion = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
      max_tokens: 400
    });
    
    return completion.choices[0].message.content || '<h3>Market Analysis</h3><p>Unable to generate analysis at this time.</p>';
  } catch (error) {
    console.error('Error generating market analysis:', error);
    return '<h3>Market Analysis</h3><p>Unable to generate analysis at this time due to a technical issue.</p><p>In the meantime, ensure your portfolio is diversified across different pools.</p><p>Monitor market trends for new opportunities.</p>';
  }
}

// Function to initialize email schedules based on user preferences
export function initializeEmailSchedules(): void {
  // Schedule daily tips every 5 minutes for testing (was: '0 9 * * *' for 9 AM daily)
  cron.schedule('0 9 * * *', async () => {
    console.log('Sending daily DeFi tips...');
    try {
      const users = await prisma.emailNotification.findMany({
        where: { schedule: 'daily' },
        include: { user: true }
      });
      console.log('Users found:', users.length, 'users');
      
      if (users.length === 0) {
        console.log('No users found with daily schedule');
        return;
      }

      for (const user of users) {
        console.log('Processing user:', {
          email: user.email,
          wallet: user.userWallet,
          riskLevel: user.riskLevel
        });
        
        await sendDailyDeFiTips({
          email: user.email,
          schedule: user.schedule as 'daily' | 'weekly' | 'realtime',
          riskLevel: user.riskLevel,
          userWallet: user.userWallet!,
          topicPreferences: user.topicPreferences,
          notifications: user.notificationsEnabled,
          protocol: 'Solana DeFi'
        });
      }
    } catch (error) {
      console.error('Error processing users:', error instanceof Error ? error.message : 'Unknown error');
    }
  });

  // Schedule weekly summaries on Monday at 10 AM
  cron.schedule('0 10 * * 1', async () => {
    console.log('Sending weekly DeFi summaries...');
    try {
      const users = await prisma.emailNotification.findMany({
        where: { schedule: 'weekly' },
        include: { user: true }
      });
      for (const user of users) {
        console.log('Processing weekly user:', {
          email: user.email,
          wallet: user.userWallet,
          riskLevel: user.riskLevel
        });
        await sendDailyDeFiTips({
          email: user.email,
          schedule: user.schedule as 'daily' | 'weekly' | 'realtime',
          riskLevel: user.riskLevel,
          userWallet: user.userWallet!,
          topicPreferences: Array.isArray(user.topicPreferences) ? user.topicPreferences : [],
          notifications: user.notificationsEnabled,
          protocol: 'Solana DeFi'
        });
      }
    } catch (error) {
      console.error('Error processing weekly users:', error instanceof Error ? error.message : 'Unknown error');
    }
  });

  console.log('Email schedules initialized');
}