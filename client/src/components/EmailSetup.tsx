"use client";

import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { usePhantomWallet } from "./PhantomWallet";

const emailSchema = z.object({
  email: z.string().email({ message: "Please enter a valid email address" }),
  username: z.string().min(3, { message: "Username must be at least 3 characters" }).optional(),
  notifications: z.boolean().default(true),
  schedule: z.enum(['daily', 'weekly', 'realtime']).default('daily'),
  riskLevel: z.number().min(1).max(15).default(5),
  topicPreferences: z.array(z.string()).optional()
});

type EmailFormValues = z.infer<typeof emailSchema>;

const EmailSetup: React.FC = () => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { publicKey, connected } = usePhantomWallet();

  const form = useForm<EmailFormValues>({
    resolver: zodResolver(emailSchema),
    defaultValues: {
      email: "",
      username: "",
      notifications: true,
      schedule: "daily",
      riskLevel: 5,
      topicPreferences: []
    },
  });

  // Fetch saved email preferences
  const { data: preferences, refetch: refetchPreferences } = useQuery({
    queryKey: ['emailPreferences', publicKey?.toString()],
    queryFn: async () => {
      if (!publicKey) throw new Error("Wallet not connected");
      const response = await fetch(`/api/notifications/email/list?userWallet=${publicKey.toString()}`, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
        credentials: 'include'
      });
      if (!response.ok) {
        const text = await response.text();
        throw new Error(`Failed to fetch preferences: ${response.status} ${text}`);
      }
      const data = await response.json();
      return data.preferences || [];
    },
    enabled: !!publicKey,
  });

  // Fetch DeFi tips based on risk level
  const { data: tips } = useQuery({
    queryKey: ['defiTips', preferences?.[0]?.riskLevel],
    queryFn: async () => {
      const riskLevel = preferences?.[0]?.riskLevel || 5;
      const response = await fetch(`/api/defi/tips?riskLevel=${riskLevel}`, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
        credentials: 'include'
      });
      if (!response.ok) {
        const text = await response.text();
        throw new Error(`Failed to fetch tips: ${response.status} ${text}`);
      }
      const data = await response.json();
      return data.tips || [];
    },
    enabled: !!preferences?.length,
  });

  // Mutation for saving email settings
  const saveEmailSettings = useMutation({
    mutationFn: async (data: EmailFormValues) => {
      if (!connected || !publicKey) {
        throw new Error("Wallet not connected");
      }

      const payload = {
        email: data.email,
        userWallet: publicKey.toString(),
        username: data.username || "",
        schedule: data.schedule,
        riskLevel: data.riskLevel,
        notifications: data.notifications,
        topicPreferences: data.topicPreferences
      };

      console.log("Sending payload to /api/notifications/email/detailed:", payload);

      const response = await fetch(`/api/notifications/email/detailed`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload),
        credentials: 'include'
      });

      if (!response.ok) {
        const text = await response.text() || response.statusText;
        throw new Error(`${response.status}: ${text}`);
      }

      const contentType = response.headers.get("content-type");
      if (contentType && contentType.includes("application/json")) {
        return response.json();
      } else {
        const text = await response.text();
        throw new Error(`Unexpected response type: ${contentType}. Body: ${text}`);
      }
    },
    onSuccess: (response) => {
      if (response.success) {
        toast.success("Email notification settings saved!");
        refetchPreferences(); // Refresh preferences after saving
      } else {
        toast.error("Failed to set up email notifications: " + response.message);
      }
    },
    onError: (error) => {
      console.error("Mutation error:", error);
      toast.error("Failed to save notification settings: " + (error instanceof Error ? error.message : "Unknown error"));
    },
    onSettled: () => {
      setIsSubmitting(false);
    }
  });

  const onSubmit = async (data: EmailFormValues) => {
    console.log("Form submitted with data:", data);
    setIsSubmitting(true);
    saveEmailSettings.mutate(data);
  };

  return (
    <div className="p-4">
      <Form {...form}>
        <div className="max-h-[60vh] overflow-y-auto pr-2">
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem className="space-y-2">
                  <FormLabel className="text-sm font-medium text-gray-300">Notification Email</FormLabel>
                  <FormControl>
                    <Input 
                      {...field} 
                      placeholder="your@email.com" 
                      className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                    />
                  </FormControl>
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="username"
              render={({ field }) => (
                <FormItem className="space-y-2">
                  <FormLabel className="text-sm font-medium text-gray-300">Display Name (Optional)</FormLabel>
                  <FormControl>
                    <Input 
                      {...field} 
                      placeholder="Your preferred display name" 
                      className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                    />
                  </FormControl>
                  <FormDescription className="text-gray-400">
                    This name will be used in notifications and the dashboard
                  </FormDescription>
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="notifications"
              render={({ field }) => (
                <FormItem className="flex flex-row items-start space-x-3 space-y-0 py-2">
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      className="data-[state=checked]:bg-blue-600"
                    />
                  </FormControl>
                  <div className="space-y-1 leading-none">
                    <FormLabel className="font-medium text-gray-300">Position Notifications</FormLabel>
                    <FormDescription className="text-gray-400">
                      Get alerted when your position needs rebalancing or earns significant fees
                    </FormDescription>
                  </div>
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="schedule"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm font-medium text-gray-300">Notification Schedule</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select schedule" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="daily">Daily</SelectItem>
                      <SelectItem value="weekly">Weekly</SelectItem>
                      <SelectItem value="realtime">Real-time</SelectItem>
                    </SelectContent>
                  </Select>
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="topicPreferences"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm font-medium text-gray-300">Topic Preferences</FormLabel>
                  <div className="space-y-2">
                    <Checkbox
                      id="defi"
                      checked={field.value?.includes('defi')}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          field.onChange([...(field.value || []), 'defi']);
                        } else {
                          field.onChange(field.value?.filter(topic => topic !== 'defi') || []);
                        }
                      }}
                    />
                    <label htmlFor="defi" className="text-sm text-gray-400">DeFi & Liquidity</label>
                    
                    <Checkbox
                      id="market"
                      checked={field.value?.includes('market')}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          field.onChange([...(field.value || []), 'market']);
                        } else {
                          field.onChange(field.value?.filter(topic => topic !== 'market') || []);
                        }
                      }}
                    />
                    <label htmlFor="market" className="text-sm text-gray-400">Market Analysis</label>
                    
                    <Checkbox
                      id="security"
                      checked={field.value?.includes('security')}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          field.onChange([...(field.value || []), 'security']);
                        } else {
                          field.onChange(field.value?.filter(topic => topic !== 'security') || []);
                        }
                      }}
                    />
                    <label htmlFor="security" className="text-sm text-gray-400">Security Updates</label>
                  </div>
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="riskLevel"
              render={({ field }) => (
                <FormItem className="space-y-2">
                  <FormLabel className="text-sm font-medium text-gray-300">Risk Tolerance Level (1-15)</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min="1"
                      max="15"
                      {...field}
                      onChange={(e) => field.onChange(parseInt(e.target.value) || 5)}
                      className="px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                    />
                  </FormControl>
                  <FormDescription className="text-gray-400">
                    Set your risk tolerance level from 1 (lowest risk) to 15 (highest risk)
                  </FormDescription>
                </FormItem>
              )}
            />
            
            <Button 
              type="submit" 
              disabled={isSubmitting || saveEmailSettings.isPending}
              className="w-full mt-4 bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg"
            >
              {isSubmitting || saveEmailSettings.isPending ? "Saving..." : "Save Settings"}
            </Button>
          </form>

          {/* Display Saved Preferences and Tips */}
          <div className="mt-6">
            <h2 className="text-lg font-medium text-gray-300">Saved Notification Preferences</h2>
            {preferences?.length ? (
              <div className="mt-4 space-y-4">
                {preferences.map((pref: any) => (
                  <div key={pref.id} className="p-4 bg-gray-800 rounded-lg">
                    <p><strong>Email:</strong> {pref.email}</p>
                    <p><strong>Username:</strong> {pref.username || 'N/A'}</p>
                    <p><strong>Schedule:</strong> {pref.schedule}</p>
                    <p><strong>Risk Level:</strong> {pref.riskLevel}</p>
                    <p><strong>Notifications:</strong> {pref.notificationsEnabled ? 'Enabled' : 'Disabled'}</p>
                    <p><strong>Topic Preferences:</strong> {pref.topicPreferences?.join(', ') || 'None'}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-400 mt-2">No preferences saved yet.</p>
            )}

            <h2 className="text-lg font-medium text-gray-300 mt-6">DeFi Tips</h2>
            {tips?.length ? (
              <ul className="mt-4 space-y-2">
                {tips.map((tip: string, index: number) => (
                  <li key={index} className="p-3 bg-gray-800 rounded-lg text-gray-200">
                    {tip}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-gray-400 mt-2">No tips available. Save preferences to generate tips.</p>
            )}
          </div>
        </div>
      </Form>
    </div>
  );
};

export default EmailSetup;