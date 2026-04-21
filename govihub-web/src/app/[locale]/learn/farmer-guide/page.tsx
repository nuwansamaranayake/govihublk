"use client";
import { useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

/* ------------------------------------------------------------------ */
/*  Styled sub-components                                              */
/* ------------------------------------------------------------------ */

function SectionHeading({ number, title }: { number: number; title: string }) {
  return (
    <h2
      className="flex items-center gap-3 text-xl md:text-2xl font-bold text-[#1A1A2E] mt-12 mb-4 border-l-4 border-[#2D6A2E] pl-4 print:mt-8"
      id={`section-${number}`}
    >
      <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-[#2D6A2E] text-white text-sm font-bold flex-shrink-0">
        {number}
      </span>
      {title}
    </h2>
  );
}

function SubHeading({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-lg font-semibold text-[#1A1A2E] mt-6 mb-2">
      {children}
    </h3>
  );
}

function Paragraph({ children }: { children: React.ReactNode }) {
  return <p className="text-gray-700 leading-relaxed mb-4">{children}</p>;
}

function TipBox({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-green-50 border-l-4 border-green-500 rounded-r-lg p-4 my-4 print:break-inside-avoid">
      <div className="flex gap-2">
        <span className="text-green-600 flex-shrink-0">&#x2705;</span>
        <div className="text-green-900 text-sm leading-relaxed">{children}</div>
      </div>
    </div>
  );
}

function WarningBox({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-amber-50 border-l-4 border-amber-500 rounded-r-lg p-4 my-4 print:break-inside-avoid">
      <div className="flex gap-2">
        <span className="text-amber-600 flex-shrink-0">&#x26A0;&#xFE0F;</span>
        <div className="text-amber-900 text-sm leading-relaxed">{children}</div>
      </div>
    </div>
  );
}

function StepCard({
  step,
  action,
  details,
}: {
  step: number;
  action: string;
  details: string;
}) {
  return (
    <div className="flex gap-4 py-3 border-b border-gray-100 last:border-b-0">
      <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-[#2D6A2E] text-white text-xs font-bold flex-shrink-0 mt-0.5">
        {step}
      </span>
      <div>
        <span className="font-semibold text-[#1A1A2E]">{action}</span>
        <p className="text-gray-600 text-sm mt-0.5">{details}</p>
      </div>
    </div>
  );
}

function StepTable({
  steps,
}: {
  steps: { step: number; action: string; details: string }[];
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 my-4 print:break-inside-avoid">
      {steps.map((s) => (
        <StepCard key={s.step} {...s} />
      ))}
    </div>
  );
}

function BulletList({ items }: { items: React.ReactNode[] }) {
  return (
    <ul className="space-y-2 mb-4 pl-1">
      {items.map((item, i) => (
        <li key={i} className="flex gap-2 text-gray-700 text-sm leading-relaxed">
          <span className="text-[#2D6A2E] mt-1 flex-shrink-0">&#x25CF;</span>
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

function QuickRefTable({
  rows,
  headers,
}: {
  rows: { want: string; goto: string }[];
  headers: { want: string; goto: string };
}) {
  return (
    <div className="overflow-x-auto my-4">
      <table className="w-full text-sm border border-gray-200 rounded-xl overflow-hidden">
        <thead>
          <tr className="bg-[#2D6A2E] text-white">
            <th className="text-left px-4 py-3 font-semibold">{headers.want}</th>
            <th className="text-left px-4 py-3 font-semibold">{headers.goto}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className={i % 2 === 0 ? "bg-white" : "bg-green-50"}>
              <td className="px-4 py-2.5 text-gray-700">{r.want}</td>
              <td className="px-4 py-2.5 font-medium text-[#1A1A2E]">{r.goto}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Content data — English                                             */
/* ------------------------------------------------------------------ */

const en = {
  meta: {
    title: "GoviHub Spices \u2014 Farmer User Guide",
    subtitle: "Sri Lanka\u2019s AI Spice Marketplace",
    version: "Version 1.0 \u2014 April 2026",
    backLabel: "\u2190 Back to Learn",
    langToggleLabel: "SI",
    printLabel: "Print",
    ctaButton: "Get Started with GoviHub",
    youtubeText: "Watch video tutorials on our YouTube channel",
    youtubeChannel: "@GoviHubSriLanka",
    footer:
      "GoviHub Spices \u2014 Connecting Sri Lankan spice farmers to fair markets through AI",
    footerOrg: "Prepared by AiGNITE Consulting \u2014 April 2026",
  },
  sections: [
    /* ---------- 1 ---------- */
    {
      number: 1,
      title: "Getting Started",
      content: (
        <>
          <Paragraph>
            GoviHub Spices connects Sri Lankan spice farmers directly to verified
            commercial buyers. This guide walks you through every feature
            available to you as a farmer.
          </Paragraph>

          <SubHeading>1.1 What You Need</SubHeading>
          <BulletList
            items={[
              "A smartphone with internet access (Android or iPhone)",
              "Chrome, Safari, or any modern web browser",
              "Photos of your crops (for disease diagnosis)",
            ]}
          />
          <TipBox>
            <strong>Install as App:</strong> Visit spices.govihublk.com in Chrome
            and tap &quot;Add to Home Screen&quot; to install GoviHub as an app on your
            phone. It works offline for basic features.
          </TipBox>

          <SubHeading>1.2 Creating Your Account</SubHeading>
          <StepTable
            steps={[
              { step: 1, action: "Open GoviHub", details: "Go to spices.govihublk.com in your browser" },
              { step: 2, action: "Tap Register", details: 'On the landing page, tap the "Register" button' },
              { step: 3, action: "Enter Your Details", details: "Username, password, full name, phone number, and district" },
              { step: 4, action: "Select Your Role", details: 'Choose "Farmer" as your role' },
              { step: 5, action: "Select Your Crops", details: "Pick the spices you grow: pepper, turmeric, ginger, cloves, nutmeg, cardamom, or cinnamon" },
              { step: 6, action: "Set Your Location", details: "Allow GPS access or enter your district manually. This is used for weather forecasts and buyer matching" },
              { step: 7, action: "Done!", details: "You will be taken to your Farmer Dashboard" },
            ]}
          />
          <WarningBox>
            <strong>Remember Your Credentials:</strong> Write down your username
            and password. If you forget them, an admin will need to reset your
            account.
          </WarningBox>
        </>
      ),
    },
    /* ---------- 2 ---------- */
    {
      number: 2,
      title: "Your Dashboard",
      content: (
        <>
          <Paragraph>
            The dashboard is your home screen. It shows everything important at a
            glance:
          </Paragraph>
          <BulletList
            items={[
              "Weather summary for your location (today\u2019s temperature, rain forecast)",
              "Your active harvest listings and their status",
              "Recent matches with buyers",
              "Notification badge showing unread alerts",
            ]}
          />
          <TipBox>
            <strong>Check Daily:</strong> Open GoviHub every morning to see
            weather alerts and new buyer matches. The weather card on your
            dashboard shows the first 3 days of reliable forecasts.
          </TipBox>
        </>
      ),
    },
    /* ---------- 3 ---------- */
    {
      number: 3,
      title: "Creating Harvest Listings",
      content: (
        <>
          <Paragraph>
            A harvest listing tells buyers what you have available to sell. This
            is the core of how you connect with buyers on GoviHub.
          </Paragraph>

          <SubHeading>3.1 How to Create a Listing</SubHeading>
          <StepTable
            steps={[
              { step: 1, action: "Go to Listings", details: 'Tap "Listings" from the bottom navigation bar or the More menu' },
              { step: 2, action: 'Tap "Create New"', details: "The create listing form will open" },
              { step: 3, action: "Select Crop Type", details: "Choose from: black pepper, turmeric, ginger, cloves, nutmeg, cardamom, cinnamon, or mixed spices" },
              { step: 4, action: "Enter Quantity", details: "How many kilograms you have available" },
              { step: 5, action: "Set Your Price", details: "Price per kilogram in Sri Lankan Rupees (LKR)" },
              { step: 6, action: "Add Quality Grade", details: "Select the grade of your harvest (Grade A, B, or C)" },
              { step: 7, action: "Set Available Date", details: "When the harvest will be ready for collection" },
              { step: 8, action: "Upload Photo", details: "Take a photo of your harvest. Buyers prefer listings with photos" },
              { step: 9, action: "Add Description", details: "Any extra details: organic, dried/fresh, processing method, etc." },
              { step: 10, action: "Submit", details: "Your listing goes live and the matching engine starts looking for buyers" },
            ]}
          />

          <SubHeading>3.2 Managing Your Listings</SubHeading>
          <Paragraph>After creating a listing, you can:</Paragraph>
          <BulletList
            items={[
              <><strong>Edit</strong> \u2014 Update quantity, price, or description at any time</>,
              <><strong>Change Status</strong> \u2014 Mark as sold, expired, or reactivate</>,
              <><strong>Delete</strong> \u2014 Remove a listing you no longer need</>,
            ]}
          />
          <TipBox>
            <strong>Listing Tips:</strong> Keep prices competitive by checking the
            Price Trends section. Listings with photos get 3x more buyer
            interest. Update quantity as you sell to avoid over-committing.
          </TipBox>
        </>
      ),
    },
    /* ---------- 4 ---------- */
    {
      number: 4,
      title: "Smart Matching with Buyers",
      content: (
        <>
          <Paragraph>
            GoviHub&apos;s matching engine automatically pairs your harvest listings
            with buyer demand postings. It scores each potential match based on:
          </Paragraph>
          <BulletList
            items={[
              <><strong>Distance</strong> between you and the buyer (35% weight) \u2014 closer buyers are preferred</>,
              <><strong>Quantity fit</strong> (25%) \u2014 does your harvest size match what they need?</>,
              <><strong>Date overlap</strong> (25%) \u2014 is your harvest ready when they need it?</>,
              <><strong>Listing freshness</strong> (15%) \u2014 newer listings get a boost</>,
            ]}
          />

          <SubHeading>4.1 Working with Matches</SubHeading>
          <Paragraph>
            When a match is found, you&apos;ll see it on your Matches page and receive
            a notification. For each match, you can:
          </Paragraph>
          <StepTable
            steps={[
              { step: 1, action: "Review the Match", details: "See the buyer\u2019s name, location, requested quantity, and price range" },
              { step: 2, action: "Accept", details: 'You agree to supply this buyer. The match moves to "accepted" status' },
              { step: 3, action: "Reject", details: "Not interested. The match is removed" },
              { step: 4, action: "Dismiss", details: "Ignore for now without rejecting" },
              { step: 5, action: "Complete/Fulfill", details: "After delivering the goods, mark the match as completed" },
            ]}
          />
          <WarningBox>
            <strong>Reliability Matters:</strong> Accepting a match and then not
            delivering hurts your profile. Only accept matches you can fulfill.
            Your fulfillment history builds your reputation.
          </WarningBox>
        </>
      ),
    },
    /* ---------- 5 ---------- */
    {
      number: 5,
      title: "AI Crop Disease Diagnosis",
      content: (
        <>
          <Paragraph>
            If your spice crop looks unhealthy, GoviHub&apos;s AI can help identify
            the problem and suggest treatments.
          </Paragraph>

          <SubHeading>5.1 How to Use Diagnosis</SubHeading>
          <StepTable
            steps={[
              { step: 1, action: "Go to Diagnosis", details: 'Tap "Diagnosis" from the navigation menu' },
              { step: 2, action: "Upload a Photo", details: "Take a clear, close-up photo of the affected leaf or plant part. Good lighting is essential" },
              { step: 3, action: "Wait for Analysis", details: "The AI (Claude Sonnet 4) analyzes your image. This takes 5\u201315 seconds" },
              { step: 4, action: "Read the Results", details: "You\u2019ll see: the identified disease name (in English and Sinhala), treatment recommendations, and prevention advice" },
              { step: 5, action: "Rate the Result", details: "Give feedback on whether the diagnosis was helpful \u2014 this improves the system" },
            ]}
          />
          <TipBox>
            <strong>Better Photos = Better Diagnosis:</strong> Photograph
            individual leaves showing symptoms. Avoid blurry images. Include both
            healthy and affected areas for comparison. Natural daylight gives best
            results.
          </TipBox>

          <SubHeading>5.2 Diagnosis History</SubHeading>
          <Paragraph>
            All your past diagnoses are saved. Go to Diagnosis &gt; History to
            review previous results and track how treatments are working.
          </Paragraph>
        </>
      ),
    },
    /* ---------- 6 ---------- */
    {
      number: 6,
      title: "AI Farm Advisory",
      content: (
        <>
          <Paragraph>
            The Farm Advisory is your personal agricultural consultant. Ask any
            farming question in Sinhala or English and get expert answers powered
            by Sri Lankan Department of Agriculture knowledge.
          </Paragraph>

          <SubHeading>6.1 How It Works</SubHeading>
          <Paragraph>
            The advisory uses a knowledge base of 595 articles covering all 8
            spice crops, sourced from Sri Lankan agricultural publications. When
            you ask a question:
          </Paragraph>
          <BulletList
            items={[
              "Your question is matched against the knowledge base using AI",
              "The most relevant articles are retrieved",
              "Claude AI generates a detailed answer grounded in those articles, in Sinhala",
            ]}
          />

          <SubHeading>6.2 Example Questions</SubHeading>
          <BulletList
            items={[
              "\u0D9C\u0DCA\u200D\u0DBB\u0DD3\u0DC2\u0DCA\u0DB8 \u0D9A\u0DCF\u0DBD\u0DBA\u0DA7 \u0D9C\u0DB8\u0DCA\u0DB8\u0DD2\u0DBB\u0DD2\u0DC3\u0DCA \u0DC0\u0DD9\u0DBD \u0DC4\u0DCF\u0DB1\u0DD2 \u0DC0\u0DD9\u0DB1\u0DC0\u0DCF? (What pests harm black pepper in summer?)",
              "How do I dry turmeric for best color retention?",
              "\u0D89\u0D9F\u0DD4\u0DBB\u0DD4 \u0DC0\u0DD9\u0DBD\u0DA7 \u0DC4\u0DCF\u0DBB\u0DD2 \u0DB4\u0DC4\u0DC3\u0DD4 \u0D9A\u0DD2\u0DBB\u0DD3\u0DB8\u0DA7 \u0DB8\u0DD9\u0DB1\u0DCA? (What is good fertilizer for ginger?)",
            ]}
          />
          <TipBox>
            <strong>Ask in Sinhala:</strong> The advisory gives the best answers
            in Sinhala because the knowledge base includes Sinhala agricultural
            content. You can ask in English too.
          </TipBox>
        </>
      ),
    },
    /* ---------- 7 ---------- */
    {
      number: 7,
      title: "Weather Forecasts & Alerts",
      content: (
        <>
          <Paragraph>
            GoviHub provides 5-day weather forecasts tailored to your farm
            location, with specific advice for your spice crops.
          </Paragraph>

          <SubHeading>7.1 Weather Dashboard Card</SubHeading>
          <Paragraph>
            Your dashboard shows today&apos;s weather summary: temperature, humidity,
            wind speed, and rain probability. The first 3 days are marked as
            &quot;reliable&quot; and the remaining days as &quot;outlook.&quot;
          </Paragraph>

          <SubHeading>7.2 Detailed Forecast</SubHeading>
          <Paragraph>
            Tap the weather card or go to Weather from the menu to see:
          </Paragraph>
          <BulletList
            items={[
              "5-day forecast with daily high/low temperatures",
              "Hourly detail for any day (tap a day to expand)",
              "Soil temperature and moisture data (critical for turmeric, ginger)",
              "Humidity and wind speed charts",
            ]}
          />

          <SubHeading>7.3 Weather Alerts</SubHeading>
          <Paragraph>
            GoviHub monitors weather conditions against your crop profiles and
            sends automatic alerts when:
          </Paragraph>
          <BulletList
            items={[
              "Heavy rain threatens drainage (especially for pepper, ginger)",
              "Temperature drops below critical thresholds for your crops",
              "High winds could damage vine crops like pepper",
              "Soil moisture conditions require attention",
            ]}
          />
          <Paragraph>
            Each alert comes in Sinhala with a specific action you should take
            (e.g., &quot;Clear drainage channels&quot;).
          </Paragraph>
        </>
      ),
    },
    /* ---------- 8 ---------- */
    {
      number: 8,
      title: "Supply Marketplace",
      content: (
        <>
          <Paragraph>
            Browse and inquire about farming inputs \u2014 seeds, fertilizers, tools,
            and equipment \u2014 listed by verified suppliers.
          </Paragraph>
          <StepTable
            steps={[
              { step: 1, action: "Go to Marketplace", details: 'Tap "Marketplace" from the navigation' },
              { step: 2, action: "Browse or Search", details: "Filter by category (seeds, fertilizer, tools) or search by keyword" },
              { step: 3, action: "View Details", details: "Tap any listing to see price, availability, supplier info, and photos" },
              { step: 4, action: "Contact Supplier", details: "Tap the inquiry button to reach the supplier about a product" },
            ]}
          />
        </>
      ),
    },
    /* ---------- 9 ---------- */
    {
      number: 9,
      title: "Notifications",
      content: (
        <>
          <Paragraph>GoviHub sends you notifications for:</Paragraph>
          <BulletList
            items={[
              "New buyer matches for your harvest listings",
              "Match status updates (accepted, completed, etc.)",
              "Weather alerts for your crops",
              "Platform announcements from GoviHub admins",
            ]}
          />
          <Paragraph>
            The notification bell on your dashboard shows the count of unread
            notifications. Tap it to see all notifications, and mark them as read
            individually or all at once.
          </Paragraph>
        </>
      ),
    },
    /* ---------- 10 ---------- */
    {
      number: 10,
      title: "Settings & Profile",
      content: (
        <>
          <SubHeading>10.1 Profile Settings</SubHeading>
          <Paragraph>
            Update your personal information: full name, phone number, district
            and location, land size, and farming experience.
          </Paragraph>

          <SubHeading>10.2 Crop Selection</SubHeading>
          <Paragraph>
            Go to Settings &gt; My Crops to add or remove spice crops from your
            profile. This affects which weather alerts you receive and which
            buyers are matched to you.
          </Paragraph>

          <SubHeading>10.3 Notification Preferences</SubHeading>
          <Paragraph>
            Control which notifications you receive. You can enable or disable
            alerts for matches, weather, prices, and announcements.
          </Paragraph>

          <SubHeading>10.4 Change Password</SubHeading>
          <Paragraph>
            Go to Settings &gt; Change Password. You&apos;ll need your current
            password to set a new one.
          </Paragraph>
        </>
      ),
    },
    /* ---------- 11 ---------- */
    {
      number: 11,
      title: "Giving Feedback",
      content: (
        <>
          <Paragraph>
            Help us improve GoviHub! Go to the More menu and tap
            &quot;Feedback&quot; to share your thoughts, report bugs, or suggest new
            features. Every piece of feedback is read by the GoviHub team.
          </Paragraph>
        </>
      ),
    },
    /* ---------- 12 ---------- */
    {
      number: 12,
      title: "Quick Reference",
      content: (
        <QuickRefTable
          headers={{ want: "I want to\u2026", goto: "Go to\u2026" }}
          rows={[
            { want: "Sell my harvest", goto: "Listings > Create New" },
            { want: "See buyer matches", goto: "Matches (bottom nav)" },
            { want: "Check weather", goto: "Dashboard weather card or Weather page" },
            { want: "Diagnose a sick crop", goto: "Diagnosis > Upload Photo" },
            { want: "Ask a farming question", goto: "Advisory" },
            { want: "Buy seeds/fertilizer", goto: "Marketplace" },
            { want: "See my notifications", goto: "Notification bell on dashboard" },
            { want: "Update my crops", goto: "Settings > My Crops" },
            { want: "Change my password", goto: "Settings > Change Password" },
            { want: "Give feedback", goto: "More > Feedback" },
          ]}
        />
      ),
    },
  ],
  help: {
    title: "Need Help?",
    items: [
      "Use the AI Farm Advisory to ask any farming question",
      "Submit feedback through the app (More > Feedback)",
      "Contact your local GoviHub field coordinator",
    ],
  },
};

/* ------------------------------------------------------------------ */
/*  Content data — Sinhala                                             */
/* ------------------------------------------------------------------ */

const si = {
  meta: {
    title: "GoviHub Spices \u2014 \u0D9C\u0DDC\u0DC0\u0DD2\u0DBA\u0DCF\u0DA7 \u0DB4\u0DCF\u0DC0\u0DD2\u0DA0\u0DCA\u0DA0\u0DD2 \u0D9A\u0DBB\u0DB1 \u0DC0\u0DD2\u0DAF\u0DD2\u0DC4",
    subtitle: "\u0DC1\u0DCA\u200D\u0DBB\u0DD3 \u0DBD\u0D82\u0D9A\u0DCF\u0DC0\u0DDA AI \u0D9A\u0DD4\u0DC5\u0DD4\u0DB6\u0DA9\u0DD4 \u0DC0\u0DD9\u0DC5\u0DB3\u0DB4\u0DDC\u0DC5",
    version: "\u0D85\u0DB1\u0DD4\u0DC0\u0DCF\u0DAF\u0DBA 1.0 \u2014 \u0D85\u0DB4\u0DCA\u200D\u0DBB\u0DDA\u0DBD\u0DCA 2026",
    backLabel: "\u2190 \u0D89\u0D9C\u0DD9\u0DB1\u0DD3\u0DB8 \u0DC0\u0DBD\u0DA7",
    langToggleLabel: "EN",
    printLabel: "\u0DB8\u0DD4\u0DAF\u0DCA\u200D\u0DBB\u0DAB\u0DBA",
    ctaButton: "GoviHub \u0D91\u0D9A\u0DCA\u0D9A \u0DB4\u0DA7\u0DB1\u0DCA \u0D9C\u0DB1\u0DCA\u0DB1",
    youtubeText: "\u0D85\u0DB4\u0DD9 YouTube \u0DA0\u0DD0\u0DB1\u0DBD\u0DBA\u0DD9\u0DB1\u0DCA \u0DC0\u0DD3\u0DA9\u0DD2\u0DBA\u0DDD \u0DB4\u0DCF\u0DA9\u0DB8\u0DCF\u0DBD\u0DCF \u0DB6\u0DBD\u0DB1\u0DCA\u0DB1",
    youtubeChannel: "@GoviHubSriLanka",
    footer:
      "GoviHub Spices \u2014 AI \u0DAD\u0DCF\u0D9A\u0DCA\u0DC2\u0DAB\u0DBA \u0DC4\u0DBB\u0DC4\u0DCF \u0DBD\u0D82\u0D9A\u0DCF\u0DC0\u0DDA \u0D9A\u0DD4\u0DC5\u0DD4\u0DB6\u0DA9\u0DD4 \u0D9C\u0DDC\u0DC0\u0DD3\u0DB1\u0DCA \u0DC3\u0DCF\u0DB0\u0DCF\u0DBB\u0DAB \u0DC0\u0DD9\u0DC5\u0DB3\u0DB4\u0DDC\u0DC5\u0DC0\u0DBD\u0DCA \u0DC0\u0DBD\u0DA7 \u0DC3\u0DB8\u0DCA\u0DB6\u0DB1\u0DCA\u0DB0 \u0D9A\u0DBB\u0DB1\u0DC0\u0DCF",
    footerOrg:
      "AiGNITE Consulting \u0DC0\u0DD2\u0DC3\u0DD2\u0DB1\u0DCA \u0DC3\u0D9A\u0DC3\u0DCA \u0D9A\u0DC5\u0DDA \u2014 2026 \u0D85\u0DB4\u0DCA\u200D\u0DBB\u0DDA\u0DBD\u0DCA",
  },
  sections: [
    /* ---------- 1 ---------- */
    {
      number: 1,
      title: "Getting Started",
      content: (
        <>
          <Paragraph>
            GoviHub Spices \u0D91\u0D9A\u0DD9\u0DB1\u0DCA \u0DBD\u0D82\u0D9A\u0DCF\u0DC0\u0DDA \u0D9A\u0DD4\u0DC5\u0DD4\u0DB6\u0DA9\u0DD4 \u0D9C\u0DDC\u0DC0\u0DD3\u0DB1\u0DCA\u0DC0 \u0D9A\u0DD9\u0DBD\u0DD2\u0DB1\u0DCA\u0DB8 \u0DC0\u0DD2\u0DC1\u0DCA\u0DC0\u0DCF\u0DC3\u0DC0\u0DB1\u0DCA\u0DAD \u0DC0\u0DD9\u0DC5\u0DB3 \u0D9C\u0DD0\u0DB1\u0DD4\u0DB8\u0DCA\u0D9A\u0DBB\u0DD4\u0DC0\u0DB1\u0DCA\u0DA7 \u0DC3\u0DB8\u0DCA\u0DB6\u0DB1\u0DCA\u0DB0 \u0D9A\u0DBB\u0DB1\u0DC0\u0DCF. \u0DB8\u0DDA \u0DB8\u0D9C\u0DB4\u0DD9\u0DB1\u0DCA\u0DC0\u0DD3\u0DB8\u0DD9\u0DB1\u0DCA \u0D94\u0DBA\u0DCF\u0DA7 \u0D9C\u0DDC\u0DC0\u0DD2\u0DBA\u0DD9\u0D9A\u0DCA \u0DC0\u0DD2\u0DAF\u0DD2\u0DBA\u0DA7 \u0DB4\u0DCF\u0DC0\u0DD2\u0DA0\u0DCA\u0DA0\u0DD2 \u0D9A\u0DBB\u0DB1\u0DCA\u0DB1 \u0DB4\u0DD4\u0DC5\u0DD4\u0DC0\u0DB1\u0DCA \u0DC4\u0DD0\u0DB8 \u0DB4\u0DC4\u0DC3\u0DD4\u0D9A\u0DB8\u0D9A\u0DCA\u0DB8 \u0D9C\u0DD0\u0DB1 \u0D9A\u0DD2\u0DBA\u0DBD\u0DCF \u0DAF\u0DD9\u0DB1\u0DC0\u0DCF.
          </Paragraph>

          <SubHeading>1.1 What You Need</SubHeading>
          <BulletList
            items={[
              "\u0D85\u0DB1\u0DCA\u0DAD\u0DBB\u0DCA\u0DA2\u0DCF\u0DBD \u0DB4\u0DC4\u0DC3\u0DD4\u0D9A\u0DB8\u0DCA \u0DAD\u0DD2\u0DBA\u0DD9\u0DB1 \u0DC3\u0DCA\u0DB8\u0DCF\u0DBB\u0DCA\u0DA7\u0DCA\u0DB4\u0DDD\u0DB1\u0DCA \u0D91\u0D9A\u0D9A\u0DCA (\u0D87\u0DB1\u0DCA\u0DA9\u0DCA\u200D\u0DBB\u0DDC\u0DBA\u0DD2\u0DA9\u0DCA \u0DC4\u0DBB\u0DD2 \u0D85\u0DBA\u0DD2\u0DB4\u0DDD\u0DB1\u0DCA \u0DC4\u0DBB\u0DD2)",
              "Chrome, Safari, \u0DB1\u0DD0\u0DAD\u0DCA\u0DB1\u0DB8\u0DCA \u0D85\u0DBD\u0DD4\u0DAD\u0DCA \u0DC0\u0DD9\u0DB6\u0DCA \u0DB6\u0DCA\u200D\u0DBB\u0DC0\u0DCA\u0DC3\u0DBB\u0DCA \u0D91\u0D9A\u0D9A\u0DCA",
              "\u0D94\u0DBA\u0DCF\u0D9C\u0DDA \u0DC0\u0D9C\u0DCF\u0DC0\u0DBD \u0DB4\u0DDC\u0DA7\u0DDD (\u0DBB\u0DDD\u0D9C \u0DC4\u0DB3\u0DD4\u0DB1\u0DCF\u0D9C\u0DD0\u0DB1\u0DD3\u0DB8 \u0DC3\u0DB3\u0DC4\u0DCF)",
            ]}
          />
          <TipBox>
            <strong>\u0D87\u0DB4\u0DCA \u0D91\u0D9A\u0D9A\u0DCA \u0DC0\u0DD2\u0DAF\u0DD2\u0DBA\u0DA7 \u0DAF\u0DCF\u0D9C\u0DB1\u0DCA\u0DB1:</strong> Chrome \u0D91\u0D9A\u0DD9\u0DB1\u0DCA spices.govihublk.com \u0DC0\u0DBD\u0DA7 \u0D9C\u0DD2\u0DC4\u0DD2\u0DB1\u0DCA &quot;Add to Home Screen&quot; \u0D9A\u0DD2\u0DBA\u0DB1 \u0D91\u0D9A \u0D94\u0DB6\u0DBD\u0DCF GoviHub \u0D91\u0D9A \u0D94\u0DBA\u0DCF\u0D9C\u0DDA \u0DB4\u0DDD\u0DB1\u0DCA \u0D91\u0D9A\u0DA7 \u0D87\u0DB4\u0DCA \u0D91\u0D9A\u0D9A\u0DCA \u0DC0\u0DD2\u0DAF\u0DD2\u0DBA\u0DA7 \u0DAF\u0DCF\u0D9C\u0DB1\u0DCA\u0DB1. \u0DB8\u0DD6\u0DBD\u0DD2\u0D9A \u0DC0\u0DD0\u0DA9\u0DC0\u0DBD\u0DA7 \u0D95\u0DB4\u0DCA\u0DBD\u0DBA\u0DD2\u0DB1\u0DCA \u0DC0\u0DD4\u0DAB\u0DAD\u0DCA \u0DC0\u0DD0\u0DA9 \u0D9A\u0DBB\u0DB1\u0DC0\u0DCF.
          </TipBox>

          <SubHeading>1.2 Creating Your Account</SubHeading>
          <StepTable
            steps={[
              { step: 1, action: "GoviHub \u0D91\u0D9A \u0D85\u0DBB\u0DD2\u0DB1\u0DCA\u0DB1", details: "\u0D94\u0DBA\u0DCF\u0D9C\u0DDA \u0DB6\u0DCA\u200D\u0DBB\u0DC0\u0DCA\u0DC3\u0DBB\u0DCA \u0D91\u0D9A\u0DD9\u0DB1\u0DCA spices.govihublk.com \u0DC0\u0DBD\u0DA7 \u0DBA\u0DB1\u0DCA\u0DB1" },
              { step: 2, action: "Register \u0D94\u0DB6\u0DB1\u0DCA\u0DB1", details: "\u0DB8\u0DD4\u0DBD\u0DCA \u0DB4\u0DD2\u0DA7\u0DD4\u0DC0\u0DDA \u0DAD\u0DD2\u0DBA\u0DD9\u0DB1 \u201CRegister\u201D \u0DB6\u0DA7\u0DB1\u0DCA \u0D91\u0D9A \u0D94\u0DB6\u0DB1\u0DCA\u0DB1" },
              { step: 3, action: "\u0D94\u0DBA\u0DCF\u0D9C\u0DDA \u0DC0\u0DD2\u0DC3\u0DCA\u0DAD\u0DBB \u0DAF\u0DD9\u0DB1\u0DCA\u0DB1", details: "\u0DBA\u0DD6\u0DC3\u0DBB\u0DCA\u0DB1\u0DDA\u0DB8\u0DCA, \u0DB4\u0DCF\u0DC3\u0DCA\u0DC0\u0DBB\u0DCA\u0DA9\u0DCA, \u0DC3\u0DB8\u0DCA\u0DB4\u0DD6\u0DBB\u0DCA\u0DAB \u0DB1\u0DB8, \u0DB4\u0DDD\u0DB1\u0DCA \u0DB1\u0DB8\u0DCA\u0DB6\u0DBB\u0DCA \u0D91\u0D9A\u0DBA\u0DD2 \u0DAF\u0DD2\u0DC3\u0DCA\u0DAD\u0DCA\u200D\u0DBB\u0DD2\u0D9A\u0DCA\u0D9A\u0DBA\u0DBA\u0DD2" },
              { step: 4, action: "\u0D94\u0DBA\u0DCF\u0D9C\u0DDA \u0DB7\u0DD6\u0DB8\u0DD2\u0D9A\u0DCF\u0DC0 \u0DAD\u0DDD\u0DBB\u0DB1\u0DCA\u0DB1", details: "\u0D94\u0DBA\u0DCF\u0D9C\u0DDA \u0DB7\u0DD6\u0DB8\u0DD2\u0D9A\u0DCF\u0DC0 \u0DC0\u0DD2\u0DAF\u0DD2\u0DBA\u0DA7 \u201CFarmer\u201D \u0D9A\u0DD2\u0DBA\u0DB1 \u0D91\u0D9A \u0DAD\u0DDD\u0DBB\u0DB1\u0DCA\u0DB1" },
              { step: 5, action: "\u0D94\u0DBA\u0DCF\u0D9C\u0DDA \u0DC0\u0D9C\u0DCF\u0DC0\u0DB1\u0DCA \u0DAD\u0DDD\u0DBB\u0DB1\u0DCA\u0DB1", details: "\u0D94\u0DBA\u0DCF \u0DC0\u0DC0\u0DB1 \u0D9A\u0DD4\u0DC5\u0DD4\u0DB6\u0DA9\u0DD4 \u0DAD\u0DDD\u0DBB\u0DB1\u0DCA\u0DB1: \u0D9C\u0DB8\u0DCA\u0DB8\u0DD2\u0DBB\u0DD2\u0DC3\u0DCA, \u0D9A\u0DC4, \u0D89\u0D9F\u0DD4\u0DBB\u0DD4, \u0D9A\u0DBB\u0DCF\u0DB6\u0DD4\u0DB1\u0DD0\u0DA7\u0DD2, \u0DC3\u0DCF\u0DAF\u0DD2\u0D9A\u0DCA\u0D9A\u0DCF, \u0D91\u0DB1\u0DC3\u0DCF\u0DBD\u0DCA, \u0DB1\u0DD0\u0DAD\u0DCA\u0DB1\u0DB8\u0DCA \u0D9A\u0DD4\u0DBB\u0DD4\u0DB3\u0DD4" },
              { step: 6, action: "\u0D94\u0DBA\u0DCF\u0D9C\u0DDA \u0DAD\u0DD0\u0DB1 \u0DC3\u0D9A\u0DC3\u0DB1\u0DCA\u0DB1", details: "GPS \u0DB4\u0DCF\u0DC0\u0DD2\u0DA0\u0DCA\u0DA0\u0DD2 \u0D9A\u0DBB\u0DB1\u0DCA\u0DB1 \u0D85\u0DC0\u0DC3\u0DBB \u0DAF\u0DD9\u0DB1\u0DCA\u0DB1, \u0DB1\u0DD0\u0DAD\u0DCA\u0DB1\u0DB8\u0DCA \u0D94\u0DBA\u0DCF\u0D9C\u0DDA \u0DAF\u0DD2\u0DC3\u0DCA\u0DAD\u0DCA\u200D\u0DBB\u0DD2\u0D9A\u0DCA\u0D9A\u0DBA \u0D85\u0DAD\u0DD2\u0DB1\u0DCA \u0D87\u0DAD\u0DD4\u0DC5\u0DAD\u0DCA \u0D9A\u0DBB\u0DB1\u0DCA\u0DB1. \u0DB8\u0DDA\u0D9A \u0D9A\u0DCF\u0DBD\u0D9C\u0DD4\u0DAB \u0D85\u0DB1\u0DCF\u0DC0\u0DD0\u0D9A\u0DD2 \u0DC3\u0DC4 \u0D9C\u0DD0\u0DB1\u0DD4\u0DB8\u0DCA\u0D9A\u0DBB\u0DD4\u0DC0\u0DB1\u0DCA \u0DC4\u0DDC\u0DBA\u0DCF\u0D9C\u0DB1\u0DCA\u0DB1 \u0DB4\u0DCF\u0DC0\u0DD2\u0DA0\u0DCA\u0DA0\u0DD2 \u0D9A\u0DBB\u0DB1\u0DC0\u0DCF" },
              { step: 7, action: "\u0DC4\u0DBB\u0DD2!", details: "\u0D94\u0DBA\u0DCF\u0D9C\u0DDA Farmer Dashboard \u0D91\u0D9A\u0DA7 \u0D94\u0DBA\u0DCF\u0DC0 \u0D85\u0DBB\u0DB1\u0DCA \u0DBA\u0DBA\u0DD2" },
            ]}
          />
          <WarningBox>
            <strong>\u0D94\u0DBA\u0DCF\u0D9C\u0DDA \u0DC0\u0DD2\u0DC3\u0DCA\u0DAD\u0DBB \u0DB8\u0DAD\u0D9A \u0DAD\u0DD2\u0DBA\u0DCF\u0D9C\u0DB1\u0DCA\u0DB1:</strong> \u0D94\u0DBA\u0DCF\u0D9C\u0DDA \u0DBA\u0DD6\u0DC3\u0DBB\u0DCA\u0DB1\u0DDA\u0DB8\u0DCA \u0D91\u0D9A\u0DBA\u0DD2 \u0DB4\u0DCF\u0DC3\u0DCA\u0DC0\u0DBB\u0DCA\u0DA9\u0DCA \u0D91\u0D9A\u0DBA\u0DD2 \u0DBD\u0DD2\u0DBA\u0DCF\u0D9C\u0DB1\u0DCA\u0DB1. \u0D91\u0DC0\u0DCF \u0D85\u0DB8\u0DAD\u0D9A \u0DC0\u0DD4\u0DAB\u0DDC\u0DAD\u0DCA, \u0D87\u0DA9\u0DCA\u0DB8\u0DD2\u0DB1\u0DCA \u0D9A\u0DD9\u0DB1\u0DD9\u0D9A\u0DCA\u0DA7 \u0D94\u0DBA\u0DCF\u0D9C\u0DDA \u0D9C\u0DD2\u0DAB\u0DD4\u0DB8 \u0D86\u0DBA\u0DD9\u0DAD\u0DCA \u0DC4\u0DAF\u0DB1\u0DCA\u0DB1 \u0DC0\u0DD9\u0DB1\u0DC0\u0DCF.
          </WarningBox>
        </>
      ),
    },
    /* ---------- 2 ---------- */
    {
      number: 2,
      title: "\u0D94\u0DBA\u0DCF\u0D9C\u0DDA Dashboard \u0D91\u0D9A",
      content: (
        <>
          <Paragraph>
            Dashboard \u0D91\u0D9A \u0DAD\u0DB8\u0DBA\u0DD2 \u0D94\u0DBA\u0DCF\u0D9C\u0DDA \u0DB4\u0DCA\u200D\u0DBB\u0DB0\u0DCF\u0DB1 \u0DAD\u0DD2\u0DBB\u0DBA. \u0D91\u0D9A\u0DD9\u0DB1\u0DCA \u0D94\u0DBA\u0DCF\u0DA7 \u0DC0\u0DD0\u0DAF\u0D9C\u0DAD\u0DCA \u0DC4\u0DD0\u0DB8\u0DAF\u0DDA\u0DB8 \u0D91\u0D9A\u0DB4\u0DCF\u0DBB\u0DA7\u0DB8 \u0DB6\u0DBD\u0DCF\u0D9C\u0DB1\u0DCA\u0DB1 \u0DB4\u0DD4\u0DC5\u0DD4\u0DC0\u0DB1\u0DCA:
          </Paragraph>
          <BulletList
            items={[
              "\u0D94\u0DBA\u0DCF \u0D89\u0DB1\u0DCA\u0DB1 \u0DAD\u0DD0\u0DB1\u0DA7 \u0D85\u0DAF\u0DCF\u0DBD \u0D9A\u0DCF\u0DBD\u0D9C\u0DD4\u0DAB \u0DAD\u0DDC\u0DBB\u0DAD\u0DD4\u0DBB\u0DD4 (\u0D85\u0DAF \u0D8B\u0DC2\u0DCA\u0DAB\u0DAD\u0DCA\u0DC0\u0DBA, \u0DC0\u0DD0\u0DC3\u0DCA\u0DC3 \u0D91\u0DB1\u0DC0\u0DAF \u0D9A\u0DD2\u0DBA\u0DBD\u0DCF)",
              "\u0D94\u0DBA\u0DCF \u0DAF\u0DCF\u0DBD\u0DCF \u0DAD\u0DD2\u0DBA\u0DD9\u0DB1 \u0D85\u0DC3\u0DCA\u0DC0\u0DB1\u0DD4 \u0DAF\u0DD0\u0DB1\u0DCA\u0DC0\u0DD3\u0DB8\u0DCA \u0DC3\u0DC4 \u0D91\u0DC0\u0DCF\u0DBA\u0DDA \u0DAD\u0DAD\u0DCA\u0DAD\u0DCA\u0DC0\u0DBA",
              "\u0D85\u0DBD\u0DD4\u0DAD\u0DD2\u0DB1\u0DCA\u0DB8 \u0D86\u0DB4\u0DD4 \u0D9C\u0DD0\u0DB1\u0DD4\u0DB8\u0DCA\u0D9A\u0DBB\u0DD4\u0DC0\u0DB1\u0DCA\u0D9C\u0DDA \u0D9C\u0DD0\u0DBD\u0DB4\u0DD3\u0DB8\u0DCA",
              "\u0DB1\u0DDC\u0DB6\u0DBD\u0DB4\u0DD4 \u0DAF\u0DD0\u0DB1\u0DD4\u0DB8\u0DCA\u0DAF\u0DD3\u0DB8\u0DCA \u0DAD\u0DD2\u0DBA\u0DD9\u0DB1\u0DC0\u0DCF \u0DB1\u0DB8\u0DCA \u0D91\u0D9A \u0DB4\u0DD9\u0DB1\u0DCA\u0DB1\u0DB1 \u0DB4\u0DDC\u0DA9\u0DD2 \u0DC3\u0DBD\u0D9A\u0DD4\u0DAB\u0D9A\u0DCA",
            ]}
          />
          <TipBox>
            <strong>\u0DC4\u0DD0\u0DB8\u0DAF\u0DCF\u0DB8 \u0DB6\u0DBD\u0DB1\u0DCA\u0DB1:</strong> \u0DC4\u0DD0\u0DB8 \u0D8B\u0DAF\u0DDA\u0DB8 GoviHub \u0D87\u0DB4\u0DCA \u0D91\u0D9A \u0D87\u0DBB\u0DBD\u0DCF \u0D9A\u0DCF\u0DBD\u0D9C\u0DD4\u0DAB \u0D85\u0DB1\u0DAD\u0DD4\u0DBB\u0DD4 \u0D87\u0D9F\u0DC0\u0DD3\u0DB8\u0DCA \u0DC3\u0DC4 \u0D85\u0DBD\u0DD4\u0DAD\u0DCA \u0D9C\u0DD0\u0DB1\u0DD4\u0DB8\u0DCA\u0D9A\u0DBB\u0DD4\u0DC0\u0DB1\u0DCA\u0D9C\u0DDA \u0D9C\u0DD0\u0DBD\u0DB4\u0DD3\u0DB8\u0DCA \u0DAD\u0DD2\u0DBA\u0DD9\u0DB1\u0DC0\u0DAF \u0D9A\u0DD2\u0DBA\u0DBD\u0DCF \u0DB6\u0DBD\u0DB1\u0DCA\u0DB1. \u0D94\u0DBA\u0DCF\u0D9C\u0DDA Dashboard \u0D91\u0D9A\u0DDA \u0DAD\u0DD2\u0DBA\u0DD9\u0DB1 \u0D9A\u0DCF\u0DBD\u0D9C\u0DD4\u0DAB \u0D9A\u0DCF\u0DA9\u0DCA \u0D91\u0D9A\u0DD9\u0DB1\u0DCA \u0DB8\u0DD4\u0DBD\u0DCA \u0DAF\u0DC0\u0DC3\u0DCA 3\u0DA7 \u0DC0\u0DD2\u0DC1\u0DCA\u0DC0\u0DCF\u0DC3\u0DAF\u0DCF\u0DBA\u0D9A \u0D85\u0DB1\u0DCF\u0DC0\u0DD0\u0D9A\u0DD2 \u0DB4\u0DD9\u0DB1\u0DCA\u0DB1\u0DB1\u0DC0\u0DCF.
          </TipBox>
        </>
      ),
    },
    /* ---------- 3 ---------- */
    {
      number: 3,
      title: "\u0D85\u0DC3\u0DCA\u0DC0\u0DB1\u0DD4 \u0DBD\u0DD0\u0DBA\u0DD2\u0DC3\u0DCA\u0DAD\u0DD4 \u0DAF\u0DCF\u0DB1 \u0DC4\u0DD0\u0DA7\u0DD2",
      content: (
        <>
          <Paragraph>
            \u0D85\u0DC3\u0DCA\u0DC0\u0DB1\u0DD4 \u0DBD\u0DD0\u0DBA\u0DD2\u0DC3\u0DCA\u0DAD\u0DD4\u0DC0\u0D9A\u0DCA \u0D9A\u0DD2\u0DBA\u0DB1\u0DCA\u0DB1\u0DDA \u0D94\u0DBA\u0DCF\u0DA7 \u0DC0\u0DD2\u0D9A\u0DD4\u0DAB\u0DB1\u0DCA\u0DB1 \u0DAD\u0DD2\u0DBA\u0DD9\u0DB1 \u0DAF\u0DDA\u0DC0\u0DBD\u0DCA \u0D9C\u0DD0\u0DB1 \u0D9C\u0DD0\u0DB1\u0DD4\u0DB8\u0DCA\u0D9A\u0DBB\u0DD4\u0DC0\u0DB1\u0DCA\u0DA7 \u0D9A\u0DD2\u0DBA\u0DB1 \u0D91\u0D9A. GoviHub \u0D91\u0D9A\u0DDA \u0D9C\u0DD0\u0DB1\u0DD4\u0DB8\u0DCA\u0D9A\u0DBB\u0DD4\u0DC0\u0DB1\u0DCA \u0D91\u0D9A\u0DCA\u0D9A \u0DC3\u0DB8\u0DCA\u0DB6\u0DB1\u0DCA\u0DB0 \u0DC0\u0DD9\u0DB1\u0DCA\u0DB1 \u0DAD\u0DD2\u0DBA\u0DD9\u0DB1 \u0DB4\u0DCA\u200D\u0DBB\u0DB0\u0DCF\u0DB1\u0DB8 \u0DC0\u0DD2\u0DAF\u0DD2\u0DC4 \u0DB8\u0DDA\u0D9A \u0DAD\u0DB8\u0DBA\u0DD2.
          </Paragraph>

          <SubHeading>3.1 \u0DBD\u0DD0\u0DBA\u0DD2\u0DC3\u0DCA\u0DAD\u0DD4\u0DC0\u0D9A\u0DCA \u0DAF\u0DCF\u0DB1 \u0DC4\u0DD0\u0DA7\u0DD2</SubHeading>
          <StepTable
            steps={[
              { step: 1, action: "\u0DBD\u0DD0\u0DBA\u0DD2\u0DC3\u0DCA\u0DAD\u0DD4 \u0DC0\u0DBD\u0DA7 \u0DBA\u0DB1\u0DCA\u0DB1", details: "\u0DB4\u0DC4\u0DC5 \u0DAD\u0DD2\u0DBA\u0DD9\u0DB1 navigation bar \u0D91\u0D9A\u0DD9\u0DB1\u0DCA \u0DC4\u0DBB\u0DD2 More menu \u0D91\u0D9A\u0DD9\u0DB1\u0DCA \u0DC4\u0DBB\u0DD2 \u201CListings\u201D \u0D9A\u0DD2\u0DBA\u0DB1 \u0D91\u0D9A \u0D94\u0DB6\u0DB1\u0DCA\u0DB1." },
              { step: 2, action: "\u201CCreate New\u201D \u0D9A\u0DD2\u0DBA\u0DB1 \u0D91\u0D9A \u0D94\u0DB6\u0DB1\u0DCA\u0DB1", details: "\u0DBD\u0DD0\u0DBA\u0DD2\u0DC3\u0DCA\u0DAD\u0DD4\u0DC0 \u0DC4\u0DAF\u0DB1\u0DCA\u0DB1 \u0DAD\u0DD2\u0DBA\u0DD9\u0DB1 form \u0D91\u0D9A \u0D87\u0DBB\u0DD9\u0DBA\u0DD2." },
              { step: 3, action: "\u0DC0\u0D9C\u0DCF \u0DC0\u0DBB\u0DCA\u0D9C\u0DBA \u0DAD\u0DDD\u0DBB\u0DB1\u0DCA\u0DB1", details: "\u0DB8\u0DDA\u0DC0\u0D9C\u0DD9\u0DB1\u0DCA \u0DAD\u0DDD\u0DBB\u0DB1\u0DCA\u0DB1: \u0D9C\u0DB8\u0DCA\u0DB8\u0DD2\u0DBB\u0DD2\u0DC3\u0DCA, \u0D9A\u0DC4, \u0D89\u0D9F\u0DD4\u0DBB\u0DD4, \u0D9A\u0DBB\u0DCF\u0DB6\u0DD4\u0DB1\u0DD0\u0DA7\u0DD2, \u0DC3\u0DCF\u0DAF\u0DD2\u0D9A\u0DCA\u0D9A\u0DCF, \u0D91\u0DB1\u0DC3\u0DCF\u0DBD\u0DCA, \u0D9A\u0DD4\u0DBB\u0DD4\u0DB3\u0DD4, \u0DB1\u0DD0\u0DAD\u0DCA\u0DB1\u0DB8\u0DCA \u0DB8\u0DD2\u0DC1\u0DCA\u200D\u0DBB \u0D9A\u0DD4\u0DC5\u0DD4\u0DB6\u0DA9\u0DD4." },
              { step: 4, action: "\u0DB4\u0DCA\u200D\u0DBB\u0DB8\u0DCF\u0DAB\u0DBA \u0D87\u0DAD\u0DD4\u0DC5\u0DAD\u0DCA \u0D9A\u0DBB\u0DB1\u0DCA\u0DB1", details: "\u0D94\u0DBA\u0DCF \u0DC5\u0D9F \u0DAD\u0DD2\u0DBA\u0DD9\u0DB1 \u0D9A\u0DD2\u0DBD\u0DDD\u0D9C\u0DCA\u200D\u0DBB\u0DD0\u0DB8\u0DCA \u0D9C\u0DCF\u0DB1." },
              { step: 5, action: "\u0D94\u0DBA\u0DCF\u0D9C\u0DDA \u0DB8\u0DD2\u0DBD \u0DB1\u0DD2\u0DBA\u0DB8 \u0D9A\u0DBB\u0DB1\u0DCA\u0DB1", details: "\u0D9A\u0DD2\u0DBD\u0DDD\u0D9C\u0DCA\u200D\u0DBB\u0DD0\u0DB8\u0DCA \u0D91\u0D9A\u0D9A \u0DB8\u0DD2\u0DBD LKR \u0DC0\u0DBD\u0DD2\u0DB1\u0DCA." },
              { step: 6, action: "\u0D9C\u0DD4\u0DAB\u0DCF\u0DAD\u0DCA\u0DB8\u0D9A \u0DB7\u0DCF\u0DC0\u0DBA (Grade) \u0D91\u0D9A\u0DAD\u0DD4 \u0D9A\u0DBB\u0DB1\u0DCA\u0DB1", details: "\u0D94\u0DBA\u0DCF\u0D9C\u0DDA \u0D85\u0DC3\u0DCA\u0DC0\u0DD0\u0DB1\u0DCA\u0DB1\u0DDA grade \u0D91\u0D9A \u0DAD\u0DDD\u0DBB\u0DB1\u0DCA\u0DB1 (Grade A, B, \u0DB1\u0DD0\u0DAD\u0DCA\u0DB1\u0DB8\u0DCA C)." },
              { step: 7, action: "\u0DBD\u0DB6\u0DCF \u0DAF\u0DD2\u0DBA \u0DC4\u0DD0\u0D9A\u0DD2 \u0DAF\u0DD2\u0DB1\u0DBA \u0DC3\u0D9A\u0DC3\u0DB1\u0DCA\u0DB1", details: "\u0D85\u0DC3\u0DCA\u0DC0\u0DD0\u0DB1\u0DCA\u0DB1 \u0D91\u0D9A\u0DAD\u0DD4 \u0D9A\u0DBB\u0D9C\u0DB1\u0DCA\u0DB1 \u0DC3\u0DD6\u0DAF\u0DCF\u0DB1\u0DB8\u0DCA \u0DC0\u0DD9\u0DB1\u0DCA\u0DB1\u0DDA \u0D9A\u0DC0\u0DAF\u0DAF \u0D9A\u0DD2\u0DBA\u0DBD\u0DCF." },
              { step: 8, action: "Photo \u0D91\u0D9A\u0D9A\u0DCA upload \u0D9A\u0DBB\u0DB1\u0DCA\u0DB1", details: "\u0D94\u0DBA\u0DCF\u0D9C\u0DDA \u0D85\u0DC3\u0DCA\u0DC0\u0DD0\u0DB1\u0DCA\u0DB1\u0DDA photo \u0D91\u0D9A\u0D9A\u0DCA \u0D9C\u0DB1\u0DCA\u0DB1. \u0D9C\u0DD0\u0DB1\u0DD4\u0DB8\u0DCA\u0D9A\u0DBB\u0DD4\u0DC0\u0DDD photo \u0DAD\u0DD2\u0DBA\u0DD9\u0DB1 \u0DBD\u0DD0\u0DBA\u0DD2\u0DC3\u0DCA\u0DAD\u0DD4 \u0DC0\u0DBD\u0DA7 \u0D9A\u0DD0\u0DB8\u0DAD\u0DD2\u0DBA\u0DD2." },
              { step: 9, action: "\u0DC0\u0DD2\u0DC3\u0DCA\u0DAD\u0DBB\u0DBA\u0D9A\u0DCA \u0D91\u0D9A\u0DAD\u0DD4 \u0D9A\u0DBB\u0DB1\u0DCA\u0DB1", details: "\u0D85\u0DB8\u0DAD\u0DBB \u0DC0\u0DD2\u0DC3\u0DCA\u0DAD\u0DBB \u0DB8\u0DDC\u0DB1\u0DC0\u0DCF \u0DC4\u0DBB\u0DD2: \u0D9A\u0DCF\u0DB6\u0DB1\u0DD2\u0D9A\u0DAF, \u0DC0\u0DDA\u0DBD\u0DB4\u0DD4\u0DAF/\u0DB1\u0DD0\u0DC0\u0DD4\u0DB8\u0DCA\u0DAF, \u0DC3\u0DD0\u0D9A\u0DC3\u0DD6 \u0D9A\u0DCA\u200D\u0DBB\u0DB8\u0DBA \u0DC0\u0D9C\u0DDA \u0DAF\u0DDA\u0DC0\u0DBD\u0DCA." },
              { step: 10, action: "Submit \u0D9A\u0DBB\u0DB1\u0DCA\u0DB1", details: "\u0D94\u0DBA\u0DCF\u0D9C\u0DDA \u0DBD\u0DD0\u0DBA\u0DD2\u0DC3\u0DCA\u0DAD\u0DD4\u0DC0 live \u0DC0\u0DD9\u0DBA\u0DD2, \u0D8A\u0DA7 \u0DB4\u0DC3\u0DCA\u0DC3\u0DDA matching engine \u0D91\u0D9A \u0D9C\u0DD0\u0DB1\u0DD4\u0DB8\u0DCA\u0D9A\u0DBB\u0DD4\u0DC0\u0DB1\u0DCA \u0DC4\u0DDC\u0DBA\u0DB1\u0DCA\u0DB1 \u0DB4\u0DA7\u0DB1\u0DCA \u0D9C\u0DB1\u0DD2\u0DBA\u0DD2." },
            ]}
          />

          <SubHeading>3.2 \u0D94\u0DBA\u0DCF\u0D9C\u0DDA \u0DBD\u0DD0\u0DBA\u0DD2\u0DC3\u0DCA\u0DAD\u0DD4 \u0DB6\u0DBD\u0DCF\u0D9C\u0DB1\u0DCA\u0DB1 \u0DC4\u0DD0\u0DA7\u0DD2</SubHeading>
          <Paragraph>\u0DBD\u0DD0\u0DBA\u0DD2\u0DC3\u0DCA\u0DAD\u0DD4\u0DC0\u0D9A\u0DCA \u0DC4\u0DD0\u0DAF\u0DD4\u0DC0\u0DA7 \u0DB4\u0DC3\u0DCA\u0DC3\u0DDA, \u0D94\u0DBA\u0DCF\u0DA7 \u0DB8\u0DDA \u0DAF\u0DDA\u0DC0\u0DBD\u0DCA \u0D9A\u0DBB\u0DB1\u0DCA\u0DB1 \u0DB4\u0DD4\u0DC5\u0DD4\u0DC0\u0DB1\u0DCA:</Paragraph>
          <BulletList
            items={[
              <><strong>Edit \u0D9A\u0DBB\u0DB1\u0DCA\u0DB1</strong> \u2014 \u0D95\u0DB1\u0DD0\u0DB8 \u0DC0\u0DD9\u0DBD\u0DCF\u0DC0\u0D9A \u0DB4\u0DCA\u200D\u0DBB\u0DB8\u0DCF\u0DAB\u0DBA, \u0DB8\u0DD2\u0DBD, \u0DB1\u0DD0\u0DAD\u0DCA\u0DB1\u0DB8\u0DCA \u0DC0\u0DD2\u0DC3\u0DCA\u0DAD\u0DBB update \u0D9A\u0DBB\u0DB1\u0DCA\u0DB1 \u0DB4\u0DD4\u0DC5\u0DD4\u0DC0\u0DB1\u0DCA.</>,
              <><strong>Status \u0D91\u0D9A \u0DC0\u0DD9\u0DB1\u0DC3\u0DCA \u0D9A\u0DBB\u0DB1\u0DCA\u0DB1</strong> \u2014 \u0DC0\u0DD2\u0D9A\u0DD4\u0DAB\u0DD4\u0DC0\u0DCF \u0D9A\u0DD2\u0DBA\u0DBD\u0DCF, \u0D9A\u0DBD\u0DCA \u0D89\u0D9A\u0DD4\u0DAD\u0DCA \u0DC0\u0DD4\u0DAB\u0DCF \u0D9A\u0DD2\u0DBA\u0DBD\u0DCF, \u0DB1\u0DD0\u0DAD\u0DCA\u0DB1\u0DB8\u0DCA \u0D86\u0DBA\u0DD9\u0DAD\u0DCA activate \u0D9A\u0DBB\u0DB1\u0DCA\u0DB1 \u0DB4\u0DD4\u0DC5\u0DD4\u0DC0\u0DB1\u0DCA.</>,
              <><strong>Delete \u0D9A\u0DBB\u0DB1\u0DCA\u0DB1</strong> \u2014 \u0D94\u0DBA\u0DCF\u0DA7 \u0DAD\u0DC0\u0DAF\u0DD4\u0DBB\u0DA7\u0DAD\u0DCA \u0D95\u0DB1 \u0DB1\u0DD0\u0DAD\u0DD2 \u0DBD\u0DD0\u0DBA\u0DD2\u0DC3\u0DCA\u0DAD\u0DD4\u0DC0\u0D9A\u0DCA \u0D85\u0DBA\u0DD2\u0DB1\u0DCA \u0D9A\u0DBB\u0DB1\u0DCA\u0DB1.</>,
            ]}
          />
          <TipBox>
            <strong>\u0DBD\u0DD0\u0DBA\u0DD2\u0DC3\u0DCA\u0DAD\u0DD4 \u0D9C\u0DD0\u0DB1 \u0D8B\u0DB4\u0DAF\u0DD9\u0DC3\u0DCA:</strong> Price Trends section \u0D91\u0D9A \u0DB6\u0DBD\u0DBD\u0DCF \u0DB8\u0DD2\u0DBD \u0D9C\u0DAB\u0DB1\u0DCA \u0DAD\u0DBB\u0D9F\u0D9A\u0DCF\u0DBB\u0DD3\u0DC0 \u0DAD\u0DD2\u0DBA\u0DCF\u0D9C\u0DB1\u0DCA\u0DB1. Photo \u0DAD\u0DD2\u0DBA\u0DD9\u0DB1 \u0DBD\u0DD0\u0DBA\u0DD2\u0DC3\u0DCA\u0DAD\u0DD4 \u0DC0\u0DBD\u0DA7 \u0D9C\u0DD0\u0DB1\u0DD4\u0DB8\u0DCA\u0D9A\u0DBB\u0DD4\u0DC0\u0DB1\u0DCA\u0D9C\u0DDA \u0D8B\u0DB1\u0DB1\u0DCA\u0DAF\u0DD4\u0DC0 3x \u0DC0\u0DD0\u0DA9\u0DD2 \u0DC0\u0DD9\u0DB1\u0DC0\u0DCF. \u0DC0\u0DD2\u0D9A\u0DD4\u0DAB\u0DB1\u0D9A\u0DDC\u0DA7 \u0DB4\u0DCA\u200D\u0DBB\u0DB8\u0DCF\u0DAB\u0DBA update \u0D9A\u0DBB\u0DB1\u0DCA\u0DB1, \u0D91\u0DAD\u0D9A\u0DDC\u0DA7 \u0D95\u0DB1\u0DC0\u0DA7 \u0DC0\u0DA9\u0DCF \u0DB4\u0DDC\u0DBB\u0DDC\u0DB1\u0DCA\u0DAF\u0DD4 \u0DC0\u0DD9\u0DB1 \u0D91\u0D9A \u0DC0\u0DC5\u0D9A\u0DCA\u0DC0\u0DCF \u0D9C\u0DB1\u0DCA\u0DB1 \u0DB4\u0DD4\u0DC5\u0DD4\u0DC0\u0DB1\u0DCA.
          </TipBox>
        </>
      ),
    },
    /* ---------- 4 ---------- */
    {
      number: 4,
      title: "\u0D9C\u0DD0\u0DB1\u0DD4\u0DB8\u0DCA\u0D9A\u0DBB\u0DD4\u0DC0\u0DB1\u0DCA \u0D91\u0D9A\u0DCA\u0D9A \u0DC4\u0DDC\u0DB3\u0DA7 \u0D9C\u0DD0\u0DBD\u0DB4\u0DD9\u0DB1 \u0DC0\u0DD2\u0DAF\u0DD2\u0DBA",
      content: (
        <>
          <Paragraph>
            GoviHub \u0D91\u0D9A\u0DDA \u0DAD\u0DD2\u0DBA\u0DD9\u0DB1 \u0D9C\u0DD0\u0DBD\u0DB4\u0DD3\u0DB8\u0DCA \u0D9A\u0DBB\u0DB1 \u0DC3\u0DD2\u0DC3\u0DCA\u0DA7\u0DB8\u0DCA \u0D91\u0D9A\u0DD9\u0DB1\u0DCA, \u0D94\u0DBA\u0DCF\u0D9C\u0DDA \u0D85\u0DC3\u0DCA\u0DC0\u0DD0\u0DB1\u0DCA\u0DB1 \u0DC0\u0DD2\u0DC3\u0DCA\u0DAD\u0DBB\u0DBA\u0DD2, \u0D9C\u0DD0\u0DB1\u0DD4\u0DB8\u0DCA\u0D9A\u0DBB\u0DD4\u0DC0\u0DB1\u0DCA\u0D9C\u0DDA \u0D89\u0DBD\u0DCA\u0DBD\u0DD3\u0DB8\u0DCA \u0DC0\u0DD2\u0DC3\u0DCA\u0DAD\u0DBB\u0DBA\u0DD2 \u0D89\u0DB6\u0DDA\u0DB8 \u0D9C\u0DBD\u0DB4\u0DB1\u0DC0\u0DCF. \u0D91\u0D9A\u0DD9\u0DB1\u0DCA \u0DC4\u0DD0\u0DB8 \u0D9C\u0DD0\u0DBD\u0DB4\u0DD3\u0DB8\u0D9A\u0DA7\u0DB8 \u0DBD\u0D9A\u0DD4\u0DAB\u0DD4 \u0DAF\u0DD9\u0DB1\u0DC0\u0DCF \u0DB8\u0DDA \u0DAF\u0DDA\u0DC0\u0DBD\u0DCA \u0D85\u0DB1\u0DD4\u0DC0:
          </Paragraph>
          <BulletList
            items={[
              <><strong>\u0DAF\u0DD4\u0DBB</strong> (\u0D94\u0DBA\u0DBA\u0DD2 \u0D9C\u0DD0\u0DB1\u0DD4\u0DB8\u0DCA\u0D9A\u0DBB\u0DD4\u0DBA\u0DD2 \u0D85\u0DAD\u0DBB) (35%\u0D9A \u0DC0\u0DD0\u0DAF\u0D9C\u0DAD\u0DCA\u0D9A\u0DB8\u0D9A\u0DCA) \u2014 \u0DC5\u0D9F \u0D89\u0DB1\u0DCA\u0DB1 \u0D9C\u0DD0\u0DB1\u0DD4\u0DB8\u0DCA\u0D9A\u0DBB\u0DD4\u0DC0\u0DB1\u0DCA\u0DA7 \u0DC0\u0DD0\u0DA9\u0DD2 \u0D9A\u0DD0\u0DB8\u0DD0\u0DAD\u0DCA\u0DAD\u0D9A\u0DCA \u0DAF\u0DD9\u0DB1\u0DC0\u0DCF.</>,
              <><strong>\u0DB4\u0DCA\u200D\u0DBB\u0DB8\u0DCF\u0DAB\u0DBA \u0D9C\u0DD0\u0DBD\u0DB4\u0DD3\u0DB8</strong> (25%) \u2014 \u0D94\u0DBA\u0DCF\u0D9C\u0DDA \u0D85\u0DC3\u0DCA\u0DC0\u0DD0\u0DB1\u0DCA\u0DB1\u0DDA \u0DB4\u0DCA\u200D\u0DBB\u0DB8\u0DCF\u0DAB\u0DBA \u0D91\u0DBA\u0DCF\u0DBD\u0DA7 \u0D95\u0DB1 \u0DB4\u0DCA\u200D\u0DBB\u0DB8\u0DCF\u0DAB\u0DBA\u0DA7 \u0D9C\u0DD0\u0DBD\u0DB4\u0DD9\u0DB1\u0DC0\u0DAF?</>,
              <><strong>\u0DAF\u0DD2\u0DB1 \u0D9C\u0DD0\u0DBD\u0DB4\u0DD3\u0DB8</strong> (25%) \u2014 \u0D91\u0DBA\u0DCF\u0DBD\u0DA7 \u0D95\u0DB1 \u0DC0\u0DD9\u0DBD\u0DCF\u0DC0\u0DA7 \u0D94\u0DBA\u0DCF\u0D9C\u0DDA \u0D85\u0DC3\u0DCA\u0DC0\u0DD0\u0DB1\u0DCA\u0DB1 \u0DC3\u0DD6\u0DAF\u0DCF\u0DB1\u0DB8\u0DCA\u0DAF?</>,
              <><strong>\u0DAF\u0DD0\u0DB1\u0DCA\u0DC0\u0DD3\u0DB8 \u0D85\u0DBD\u0DD4\u0DAD\u0DCA \u0DC0\u0DD3\u0DB8</strong> (15%) \u2014 \u0D85\u0DBD\u0DD4\u0DAD\u0DCA \u0DAF\u0DD0\u0DB1\u0DCA\u0DC0\u0DD3\u0DB8\u0DCA\u0DC0\u0DBD\u0DA7 \u0DC0\u0DD0\u0DA9\u0DD2 \u0D85\u0DC0\u0DC3\u0DCA\u0DAD\u0DCF\u0DC0\u0D9A\u0DCA \u0DBD\u0DD0\u0DB6\u0DD9\u0DB1\u0DC0\u0DCF.</>,
            ]}
          />

          <SubHeading>4.1 \u0D9C\u0DD0\u0DBD\u0DB4\u0DD3\u0DB8\u0DCA \u0D91\u0D9A\u0DCA\u0D9A \u0DC0\u0DD0\u0DA9 \u0D9A\u0DBB\u0DB1 \u0DC0\u0DD2\u0DAF\u0DD2\u0DBA</SubHeading>
          <Paragraph>
            \u0D9C\u0DD0\u0DBD\u0DB4\u0DD3\u0DB8\u0D9A\u0DCA \u0DC4\u0DB8\u0DCA\u0DB6\u0DD4\u0DAB\u0DCF\u0DB8, \u0D94\u0DBA\u0DCF\u0D9C\u0DDA Matches page \u0D91\u0D9A\u0DDA \u0D91\u0D9A \u0DB6\u0DBD\u0DCF\u0D9C\u0DB1\u0DCA\u0DB1 \u0DB4\u0DD4\u0DC5\u0DD4\u0DC0\u0DB1\u0DCA, \u0D91 \u0DC0\u0D9C\u0DDA\u0DB8 \u0D94\u0DBA\u0DCF\u0DA7 \u0DAF\u0DD0\u0DB1\u0DD4\u0DB8\u0DCA\u0DAF\u0DD3\u0DB8\u0D9A\u0DD4\u0DAD\u0DCA (notification) \u0D91\u0DB1\u0DC0\u0DCF. \u0DC4\u0DD0\u0DB8 \u0D9C\u0DD0\u0DBD\u0DB4\u0DD3\u0DB8\u0D9A\u0DA7\u0DB8 \u0D94\u0DBA\u0DCF\u0DA7 \u0DB8\u0DDA \u0DAF\u0DDA\u0DC0\u0DBD\u0DCA \u0D9A\u0DBB\u0DB1\u0DCA\u0DB1 \u0DB4\u0DD4\u0DC5\u0DD4\u0DC0\u0DB1\u0DCA:
          </Paragraph>
          <StepTable
            steps={[
              { step: 1, action: "\u0D9C\u0DD0\u0DBD\u0DB4\u0DD3\u0DB8 \u0DB6\u0DBD\u0DB1\u0DCA\u0DB1", details: "\u0D9C\u0DD0\u0DB1\u0DD4\u0DB8\u0DCA\u0D9A\u0DBB\u0DD4\u0D9C\u0DDA \u0DB1\u0DB8, \u0DAD\u0DD0\u0DB1, \u0D89\u0DBD\u0DCA\u0DBD\u0DB1 \u0DB4\u0DCA\u200D\u0DBB\u0DB8\u0DCF\u0DAB\u0DBA\u0DBA\u0DD2, \u0DB8\u0DD2\u0DBD \u0DB4\u0DBB\u0DCF\u0DC3\u0DBA\u0DBA\u0DD2 \u0DB6\u0DBD\u0DCF\u0D9C\u0DB1\u0DCA\u0DB1 \u0DB4\u0DD4\u0DC5\u0DD4\u0DC0\u0DB1\u0DCA." },
              { step: 2, action: "\u0DB4\u0DD2\u0DC5\u0DD2\u0D9C\u0DB1\u0DCA\u0DB1", details: "\u0DB8\u0DDA \u0D9C\u0DD0\u0DB1\u0DD4\u0DB8\u0DCA\u0D9A\u0DBB\u0DD4\u0DA7 \u0DB6\u0DA9\u0DD4 \u0DAF\u0DD9\u0DB1\u0DCA\u0DB1 \u0D94\u0DBA\u0DCF \u0D9A\u0DD0\u0DB8\u0DAD\u0DD2\u0DBA\u0DD2. \u0D91\u0DAD\u0D9A\u0DDC\u0DA7 \u0DB8\u0DDA \u0D9C\u0DD0\u0DBD\u0DB4\u0DD3\u0DB8 \u201C\u0DB4\u0DD2\u0DC5\u0DD2\u0D9C\u0DAD\u0DCA\u201D (accepted) \u0DAD\u0DAD\u0DCA\u0DAD\u0DCA\u0DC0\u0DBA\u0DA7 \u0DBA\u0DB1\u0DC0\u0DCF." },
              { step: 3, action: "\u0DB4\u0DCA\u200D\u0DBB\u0DAD\u0DD2\u0D9A\u0DCA\u0DC2\u0DDA\u0DB4 \u0D9A\u0DBB\u0DB1\u0DCA\u0DB1", details: "\u0D9A\u0DD0\u0DB8\u0DAD\u0DD2 \u0DB1\u0DD0\u0DC4\u0DD0. \u0D91\u0DAD\u0D9A\u0DDC\u0DA7 \u0D9C\u0DD0\u0DBD\u0DB4\u0DD3\u0DB8 \u0D85\u0DBA\u0DD2\u0DB1\u0DCA \u0DC0\u0DD9\u0DB1\u0DC0\u0DCF." },
              { step: 4, action: "\u0D85\u0DAD\u0DCA\u0DC4\u0DBB\u0DD2\u0DB1\u0DCA\u0DB1", details: "\u0DB4\u0DCA\u200D\u0DBB\u0DAD\u0DD2\u0D9A\u0DCA\u0DC2\u0DDA\u0DB4 \u0DB1\u0DDC\u0D9A\u0DBB \u0DAF\u0DD0\u0DB1\u0DA7 \u0DB1\u0DDC\u0DC3\u0DBD\u0D9A\u0DCF \u0DC4\u0DBB\u0DD2\u0DB1\u0DCA\u0DB1." },
              { step: 5, action: "\u0DC3\u0DB8\u0DCA\u0DB4\u0DD6\u0DBB\u0DCA\u0DAB \u0D9A\u0DBB\u0DB1\u0DCA\u0DB1/\u0D89\u0DA7\u0DD4 \u0D9A\u0DBB\u0DB1\u0DCA\u0DB1", details: "\u0DB6\u0DA9\u0DD4 \u0DAF\u0DD4\u0DB1\u0DCA\u0DB1\u0DA7 \u0DB4\u0DC3\u0DCA\u0DC3\u0DDA, \u0DB8\u0DDA \u0D9C\u0DD0\u0DBD\u0DB4\u0DD3\u0DB8 \u201C\u0DC3\u0DB8\u0DCA\u0DB4\u0DD6\u0DBB\u0DCA\u0DAB\u0DBA\u0DD2\u201D \u0D9A\u0DD2\u0DBA\u0DBD\u0DCF \u0DC3\u0DBD\u0D9A\u0DD4\u0DAB\u0DD4 \u0D9A\u0DBB\u0DB1\u0DCA\u0DB1." },
            ]}
          />
          <WarningBox>
            <strong>\u0DC0\u0DD2\u0DC1\u0DCA\u0DC0\u0DCF\u0DC3\u0DC0\u0DB1\u0DCA\u0DAD\u0D9A\u0DB8 \u0DC0\u0DD0\u0DAF\u0D9C\u0DAD\u0DCA:</strong> \u0D9C\u0DD0\u0DBD\u0DB4\u0DD3\u0DB8\u0D9A\u0DCA \u0DB4\u0DD2\u0DC5\u0DD2\u0D9C\u0DD9\u0DB1 \u0DB6\u0DA9\u0DD4 \u0DB1\u0DDC\u0DAF\u0DD4\u0DB1\u0DCA\u0DB1\u0DDC\u0DAD\u0DCA \u0D94\u0DBA\u0DCF\u0D9C\u0DDA profile \u0D91\u0D9A\u0DA7 \u0DC4\u0DCF\u0DB1\u0DD2 \u0DC0\u0DD9\u0DB1\u0DC0\u0DCF. \u0D94\u0DBA\u0DCF\u0DA7 \u0DAF\u0DD9\u0DB1\u0DCA\u0DB1 \u0DB4\u0DD4\u0DC5\u0DD4\u0DC0\u0DB1\u0DCA \u0D9C\u0DD0\u0DBD\u0DB4\u0DD3\u0DB8\u0DCA \u0DC0\u0DD2\u0DAD\u0DBB\u0D9A\u0DCA \u0DB4\u0DD2\u0DC5\u0DD2\u0D9C\u0DB1\u0DCA\u0DB1. \u0D94\u0DBA\u0DCF \u0DB6\u0DA9\u0DD4 \u0DAF\u0DD4\u0DB1\u0DCA\u0DB1 \u0DC0\u0DD2\u0DAF\u0DD2\u0DBA \u0D85\u0DB1\u0DD4\u0DC0 \u0DAD\u0DB8\u0DBA\u0DD2 \u0D94\u0DBA\u0DCF\u0D9C\u0DDA \u0DC4\u0DDC\u0DB3 \u0DB1\u0DB8 \u0DC4\u0DD0\u0DAF\u0DD9\u0DB1\u0DCA\u0DB1\u0DDA.
          </WarningBox>
        </>
      ),
    },
    /* ---------- 5 ---------- */
    {
      number: 5,
      title: "AI \u0DC0\u0DBD\u0DD2\u0DB1\u0DCA \u0DB6\u0DDD\u0D9C \u0DBB\u0DDD\u0D9C \u0DC4\u0DB3\u0DD4\u0DB1\u0DCF\u0D9C\u0DD0\u0DB1\u0DD3\u0DB8",
      content: (
        <>
          <Paragraph>
            \u0D94\u0DBA\u0DCF\u0DBD\u0D9C\u0DDA \u0D9A\u0DD4\u0DC5\u0DD4\u0DB6\u0DA9\u0DD4 \u0DC0\u0D9C\u0DCF\u0DC0 \u0D85\u0DC3\u0DB1\u0DD3\u0DB4 \u0DC0\u0DD9\u0DBD\u0DCF \u0DC0\u0D9C\u0DDA \u0DB4\u0DDA\u0DB1\u0DC0\u0DCF \u0DB1\u0DB8\u0DCA, GoviHub \u0D91\u0D9A\u0DDA AI \u0D91\u0D9A\u0DA7 \u0DB4\u0DD4\u0DC5\u0DD4\u0DC0\u0DB1\u0DCA \u0DB8\u0DDC\u0D9A\u0D9A\u0DCA\u0DAF \u0DB4\u0DCA\u200D\u0DBB\u0DC1\u0DCA\u0DB1\u0DDA \u0D9A\u0DD2\u0DBA\u0DBD\u0DCF \u0DC4\u0DDC\u0DBA\u0DBD\u0DCF, \u0D91\u0D9A\u0DA7 \u0D9A\u0DBB\u0DB1\u0DCA\u0DB1 \u0D95\u0DB1 \u0DB4\u0DCA\u200D\u0DBB\u0DAD\u0DD2\u0D9A\u0DCF\u0DBB \u0DB8\u0DDC\u0DB1\u0DC0\u0DAF \u0D9A\u0DD2\u0DBA\u0DBD\u0DCF \u0D9A\u0DD2\u0DBA\u0DB1\u0DCA\u0DB1.
          </Paragraph>

          <SubHeading>5.1 \u0DBB\u0DDD\u0D9C \u0DC4\u0DB3\u0DD4\u0DB1\u0DCF\u0D9C\u0DD0\u0DB1\u0DD3\u0DB8 \u0DB4\u0DCF\u0DC0\u0DD2\u0DA0\u0DCA\u0DA0\u0DD2 \u0D9A\u0DBB\u0DB1 \u0DC4\u0DD0\u0DA7\u0DD2</SubHeading>
          <StepTable
            steps={[
              { step: 1, action: "Diagnosis \u0DC0\u0DBD\u0DA7 \u0DBA\u0DB1\u0DCA\u0DB1", details: "navigation menu \u0D91\u0D9A\u0DD9\u0DB1\u0DCA \u201CDiagnosis\u201D \u0D9A\u0DD2\u0DBA\u0DB1 \u0D91\u0D9A \u0D94\u0DB6\u0DB1\u0DCA\u0DB1" },
              { step: 2, action: "\u0DB4\u0DDC\u0DA7\u0DDD \u0D91\u0D9A\u0D9A\u0DCA upload \u0D9A\u0DBB\u0DB1\u0DCA\u0DB1", details: "\u0D85\u0DC3\u0DB1\u0DD3\u0DB4 \u0DC0\u0DD9\u0DA0\u0DCA\u0DA0 \u0D9A\u0DDC\u0DC5\u0DDA\u0D9A \u0DC4\u0DBB\u0DD2 \u0D9C\u0DC4\u0DDA \u0D9A\u0DDC\u0DA7\u0DC3\u0D9A \u0DC4\u0DBB\u0DD2 \u0DB4\u0DD0\u0DC4\u0DD0\u0DAF\u0DD2\u0DBD\u0DD2, \u0DC5\u0D9F\u0DD2\u0DB1\u0DCA \u0D9C\u0DAD\u0DCA\u0DAD \u0DB4\u0DDC\u0DA7\u0DDD \u0D91\u0D9A\u0D9A\u0DCA \u0D9C\u0DB1\u0DCA\u0DB1. \u0DC4\u0DDC\u0DB3 \u0D91\u0DC5\u0DD2\u0DBA\u0D9A\u0DCA \u0DAD\u0DD2\u0DBA\u0DD9\u0DB1\u0DCA\u0DB1 \u0D95\u0DB1." },
              { step: 3, action: "\u0DC0\u0DD2\u0DC1\u0DCA\u0DBD\u0DDA\u0DC2\u0DAB\u0DBA \u0DC0\u0DD9\u0DB1\u0D9A\u0DB8\u0DCA \u0D89\u0DB1\u0DCA\u0DB1", details: "AI \u0D91\u0D9A (Claude Sonnet 4) \u0D94\u0DBA\u0DCF\u0D9C\u0DDA \u0DB4\u0DDC\u0DA7\u0DDD \u0D91\u0D9A \u0DC0\u0DD2\u0DC1\u0DCA\u0DBD\u0DDA\u0DC2\u0DAB\u0DBA \u0D9A\u0DBB\u0DB1\u0DC0\u0DCF. \u0DB8\u0DDA\u0D9A\u0DA7 \u0DAD\u0DAD\u0DCA\u0DB4\u0DBB 5\u201315\u0D9A\u0DCA \u0DC0\u0DD2\u0DAD\u0DBB \u0DBA\u0DB1\u0DC0\u0DCF." },
              { step: 4, action: "\u0DB4\u0DCA\u200D\u0DBB\u0DAD\u0DD2\u0DB5\u0DBD \u0DB6\u0DBD\u0DB1\u0DCA\u0DB1", details: "\u0D94\u0DBA\u0DCF\u0DA7 \u0DB4\u0DDA\u0DBA\u0DD2: \u0DC4\u0DB3\u0DD4\u0DB1\u0DCF\u0D9C\u0DAD\u0DCA \u0DBB\u0DDD\u0D9C\u0DBA\u0DDA \u0DB1\u0DB8 (English \u0DC3\u0DC4 \u0DC3\u0DD2\u0D82\u0DC4\u0DBD\u0DD9\u0DB1\u0DCA), \u0DB4\u0DCA\u200D\u0DBB\u0DAD\u0DD2\u0D9A\u0DCF\u0DBB \u0DB1\u0DD2\u0DBB\u0DCA\u0DAF\u0DDA\u0DC1, \u0DC3\u0DC4 \u0DC0\u0DC5\u0D9A\u0DCA\u0DC0\u0DCF\u0D9C\u0DB1\u0DCA\u0DB1 \u0DB4\u0DD4\u0DC5\u0DD4\u0DC0\u0DB1\u0DCA \u0D8B\u0DB4\u0DAF\u0DD9\u0DC3\u0DCA." },
              { step: 5, action: "\u0DB4\u0DCA\u200D\u0DBB\u0DAD\u0DD2\u0DB5\u0DBD\u0DBA \u0D9C\u0DD0\u0DB1 \u0D85\u0DAF\u0DC4\u0DC3\u0D9A\u0DCA \u0DAF\u0DD9\u0DB1\u0DCA\u0DB1", details: "\u0DBB\u0DDD\u0D9C\u0DBA \u0DC4\u0DB3\u0DD4\u0DB1\u0DCF\u0D9C\u0DD0\u0DB1\u0DD3\u0DB8 \u0DB4\u0DCA\u200D\u0DBB\u0DBA\u0DDD\u0DA2\u0DB1\u0DC0\u0DAD\u0DCA \u0DC0\u0DD4\u0DAB\u0DCF\u0DAF \u0D9A\u0DD2\u0DBA\u0DBD\u0DCF \u0D85\u0DAF\u0DC4\u0DC3\u0D9A\u0DCA \u0DAF\u0DD9\u0DB1\u0DCA\u0DB1 \u2014 \u0DB8\u0DDA\u0D9A\u0DD9\u0DB1\u0DCA system \u0D91\u0D9A \u0DAD\u0DC0\u0DAD\u0DCA \u0DC4\u0DDC\u0DB3 \u0DC0\u0DD9\u0DB1\u0DC0\u0DCF." },
            ]}
          />
          <TipBox>
            <strong>\u0DC4\u0DDC\u0DB3 \u0DB4\u0DDC\u0DA7\u0DDD = \u0DC4\u0DDC\u0DB3 \u0DBB\u0DDD\u0D9C \u0DC4\u0DB3\u0DD4\u0DB1\u0DCF\u0D9C\u0DD0\u0DB1\u0DD3\u0DB8:</strong> \u0DBB\u0DDD\u0D9C \u0DBD\u0D9A\u0DCA\u0DC2\u0DAB \u0DB4\u0DD9\u0DB1\u0DCA\u0DC0\u0DB1 \u0DAD\u0DB1\u0DD2 \u0D9A\u0DDC\u0DC5 \u0DB4\u0DDC\u0DA7\u0DDD \u0D9C\u0DB1\u0DCA\u0DB1. \u0DB4\u0DD0\u0DC4\u0DD0\u0DAF\u0DD2\u0DBD\u0DD2 \u0DB1\u0DD0\u0DAD\u0DD2 \u0DB4\u0DDC\u0DA7\u0DDD \u0D9C\u0DB1\u0DCA\u0DB1 \u0D91\u0DB4\u0DCF. \u0DC3\u0DC3\u0DB3\u0DBD\u0DCF \u0DB6\u0DBD\u0DB1\u0DCA\u0DB1 \u0DB1\u0DD2\u0DBB\u0DDD\u0D9C\u0DD3 \u0DC3\u0DC4 \u0D85\u0DC3\u0DB1\u0DD3\u0DB4 \u0DC0\u0DD9\u0DA0\u0DCA\u0DA0 \u0D9A\u0DDC\u0DA7\u0DC3\u0DCA \u0DAF\u0DD9\u0D9A\u0DB8 \u0DB4\u0DDC\u0DA7\u0DDD \u0D91\u0D9A\u0DA7 \u0D9C\u0DB1\u0DCA\u0DB1. \u0DC3\u0DCA\u0DC0\u0DCF\u0DB7\u0DCF\u0DC0\u0DD2\u0D9A \u0DAF\u0DC0\u0DBD\u0DCA \u0D91\u0DC5\u0DD2\u0DBA\u0DD9\u0DB1\u0DCA \u0DC4\u0DDC\u0DB3\u0DB8 \u0DB4\u0DCA\u200D\u0DBB\u0DAD\u0DD2\u0DB5\u0DBD \u0DBD\u0DD0\u0DB6\u0DD9\u0DB1\u0DC0\u0DCF.
          </TipBox>

          <SubHeading>5.2 \u0DBB\u0DDD\u0D9C \u0DC4\u0DB3\u0DD4\u0DB1\u0DCF\u0D9C\u0DD0\u0DB1\u0DD3\u0DB8\u0DDA \u0D89\u0DAD\u0DD2\u0DC4\u0DCF\u0DC3\u0DBA</SubHeading>
          <Paragraph>
            \u0D94\u0DBA\u0DCF \u0D9A\u0DBD\u0DD2\u0DB1\u0DCA \u0D9A\u0DBB\u0DB4\u0DD4 \u0DC4\u0DD0\u0DB8 \u0DBB\u0DDD\u0D9C \u0DC4\u0DB3\u0DD4\u0DB1\u0DCF\u0D9C\u0DD0\u0DB1\u0DD3\u0DB8\u0D9A\u0DCA\u0DB8 save \u0DC0\u0DD9\u0DBD\u0DCF \u0DAD\u0DD2\u0DBA\u0DD9\u0DB1\u0DC0\u0DCF. \u0DB4\u0DBB\u0DAB \u0DB4\u0DCA\u200D\u0DBB\u0DAD\u0DD2\u0DB5\u0DBD \u0DB6\u0DBD\u0DB1\u0DCA\u0DB1\u0DBA\u0DD2, \u0DB4\u0DCA\u200D\u0DBB\u0DAD\u0DD2\u0D9A\u0DCF\u0DBB \u0DC0\u0DD0\u0DA9 \u0D9A\u0DBB\u0DB1 \u0DC4\u0DD0\u0DA7\u0DD2 \u0DB6\u0DBD\u0DB1\u0DCA\u0DB1\u0DBA\u0DD2 Diagnosis &gt; History \u0DC0\u0DBD\u0DA7 \u0DBA\u0DB1\u0DCA\u0DB1.
          </Paragraph>
        </>
      ),
    },
    /* ---------- 6 ---------- */
    {
      number: 6,
      title: "AI \u0D9C\u0DDC\u0DC0\u0DD2 \u0D8B\u0DB4\u0DAF\u0DD9\u0DC3\u0DCA",
      content: (
        <>
          <Paragraph>
            \u0DB8\u0DDA \u0D9C\u0DDC\u0DC0\u0DD2 \u0D8B\u0DB4\u0DAF\u0DD9\u0DC3\u0DCA \u0DC3\u0DDA\u0DC0\u0DCF\u0DC0 \u0D9A\u0DD2\u0DBA\u0DB1\u0DCA\u0DB1\u0DDA \u0D94\u0DBA\u0DCF\u0D9C\u0DDA\u0DB8 \u0DB4\u0DD8\u0DAF\u0DCA\u0D9C\u0DBD\u0DD2\u0D9A \u0D9A\u0DD8\u0DC2\u0DD2\u0D9A\u0DCF\u0DBB\u0DCA\u0DB8\u0DD2\u0D9A \u0D8B\u0DB4\u0DAF\u0DDA\u0DC1\u0D9A\u0DC0\u0DBB\u0DBA\u0DCF \u0DC0\u0D9C\u0DDA. \u0DC3\u0DD2\u0D82\u0DC4\u0DBD\u0DD9\u0DB1\u0DCA \u0DC4\u0DBB\u0DD2 \u0D89\u0D82\u0D9C\u0DCA\u200D\u0DBB\u0DD3\u0DC3\u0DD2\u0DBA\u0DD9\u0DB1\u0DCA \u0DC4\u0DBB\u0DD2 \u0D95\u0DB1\u0DD0\u0DB8 \u0D9C\u0DDC\u0DC0\u0DD2\u0DAD\u0DD0\u0DB1\u0DCA \u0DB4\u0DCA\u200D\u0DBB\u0DC1\u0DCA\u0DB1\u0DBA\u0D9A\u0DCA \u0D85\u0DC4\u0DB1\u0DCA\u0DB1 \u0DB4\u0DD4\u0DC5\u0DD4\u0DC0\u0DB1\u0DCA, \u0DC1\u0DCA\u200D\u0DBB\u0DD3 \u0DBD\u0D82\u0D9A\u0DCF \u0D9A\u0DD8\u0DC2\u0DD2\u0D9A\u0DBB\u0DCA\u0DB8 \u0DAF\u0DD9\u0DB4\u0DCF\u0DBB\u0DCA\u0DAD\u0DB8\u0DDA\u0DB1\u0DCA\u0DAD\u0DD4\u0DC0\u0DDA \u0DAF\u0DD0\u0DB1\u0DD4\u0DB8\u0DD9\u0DB1\u0DCA \u0DB6\u0DBD\u0D9C\u0DD0\u0DB1\u0DCA\u0DC0\u0DD4\u0DAB \u0DC0\u0DD2\u0DC1\u0DDA\u0DC2\u0DA5 \u0D8B\u0DAD\u0DCA\u0DAD\u0DBB \u0D9C\u0DB1\u0DCA\u0DB1 \u0DB4\u0DD4\u0DC5\u0DD4\u0DC0\u0DB1\u0DCA.
          </Paragraph>

          <SubHeading>6.1 \u0DB8\u0DDA\u0D9A \u0DC0\u0DD0\u0DA9 \u0D9A\u0DBB\u0DB1\u0DCA\u0DB1\u0DDA \u0D9A\u0DDC\u0DC4\u0DDC\u0DB8\u0DAF?</SubHeading>
          <Paragraph>
            \u0DB8\u0DDA \u0D8B\u0DB4\u0DAF\u0DD9\u0DC3\u0DCA \u0DC3\u0DDA\u0DC0\u0DCF\u0DC0\u0DA7, \u0DC1\u0DCA\u200D\u0DBB\u0DD3 \u0DBD\u0D82\u0D9A\u0DCF\u0DC0\u0DDA \u0D9A\u0DD8\u0DC2\u0DD2\u0D9A\u0DCF\u0DBB\u0DCA\u0DB8\u0DD2\u0D9A \u0DB4\u0DCA\u200D\u0DBB\u0D9A\u0DCF\u0DC1\u0DB1\u0DC0\u0DBD\u0DD2\u0DB1\u0DCA \u0D9C\u0DAD\u0DCA\u0DAD, \u0D9A\u0DD4\u0DC5\u0DD4\u0DB6\u0DA9\u0DD4 \u0DB6\u0DDD\u0D9C 8\u0DB8 \u0D86\u0DC0\u0DBB\u0DAB\u0DBA \u0DC0\u0DD9\u0DB1 \u0DBD\u0DD2\u0DB4\u0DD2 595\u0D9A \u0DAF\u0DD0\u0DB1\u0DD4\u0DB8\u0DCA \u0DB4\u0DAF\u0DB1\u0DB8\u0D9A\u0DCA \u0DAD\u0DD2\u0DBA\u0DD9\u0DB1\u0DC0\u0DCF. \u0D94\u0DBA\u0DCF \u0DB4\u0DCA\u200D\u0DBB\u0DC1\u0DCA\u0DB1\u0DBA\u0D9A\u0DCA \u0D87\u0DC4\u0DD4\u0DC0\u0DB8:
          </Paragraph>
          <BulletList
            items={[
              "\u0D94\u0DBA\u0DCF\u0D9C\u0DDA \u0DB4\u0DCA\u200D\u0DBB\u0DC1\u0DCA\u0DB1\u0DBA AI \u0DB4\u0DCF\u0DC0\u0DD2\u0DA0\u0DCA\u0DA0\u0DD2 \u0D9A\u0DBB\u0DBD\u0DCF \u0DAF\u0DD0\u0DB1\u0DD4\u0DB8\u0DCA \u0DB4\u0DAF\u0DB1\u0DB8 \u0D91\u0D9A\u0DCA\u0D9A \u0D9C\u0DBD\u0DB4\u0DB1\u0DC0\u0DCF.",
              "\u0D91\u0D9A\u0DA7 \u0D85\u0DAF\u0DCF\u0DC5\u0DB8 \u0DBD\u0DD2\u0DB4\u0DD2 \u0DC4\u0DDC\u0DBA\u0DCF\u0D9C\u0DB1\u0DCA\u0DB1\u0DC0\u0DCF.",
              "Claude AI, \u0D91 \u0DBD\u0DD2\u0DB4\u0DD2\u0DC0\u0DBD \u0DAD\u0DD2\u0DBA\u0DD9\u0DB1 \u0DAF\u0DDA\u0DC0\u0DBD\u0DCA \u0DB4\u0DAF\u0DB1\u0DB8\u0DCA \u0D9A\u0DBB\u0D9C\u0DD9\u0DB1, \u0DC3\u0DD2\u0D82\u0DC4\u0DBD\u0DD9\u0DB1\u0DCA \u0DC0\u0DD2\u0DC3\u0DCA\u0DAD\u0DBB\u0DCF\u0DAD\u0DCA\u0DB8\u0D9A \u0D8B\u0DAD\u0DCA\u0DAD\u0DBB\u0DBA\u0D9A\u0DCA \u0DC4\u0DAF\u0DB1\u0DC0\u0DCF.",
            ]}
          />

          <SubHeading>6.2 \u0D8B\u0DAF\u0DCF\u0DC4\u0DBB\u0DAB \u0DB4\u0DCA\u200D\u0DBB\u0DC1\u0DCA\u0DB1</SubHeading>
          <BulletList
            items={[
              "\u0D9C\u0DCA\u200D\u0DBB\u0DD3\u0DC2\u0DCA\u0DB8 \u0D9A\u0DCF\u0DBD\u0DBA\u0DA7 \u0D9C\u0DB8\u0DCA\u0DB8\u0DD2\u0DBB\u0DD2\u0DC3\u0DCA \u0DC0\u0DD9\u0DBD \u0DC4\u0DCF\u0DB1\u0DD2 \u0DC0\u0DD9\u0DB1\u0DC0\u0DCF? (What pests harm black pepper in summer?)",
              "How do I dry turmeric for best color retention?",
              "\u0D89\u0D9F\u0DD4\u0DBB\u0DD4 \u0DC0\u0DD9\u0DBD\u0DA7 \u0DC4\u0DCF\u0DBB\u0DD2 \u0DB4\u0DC4\u0DC3\u0DD4 \u0D9A\u0DD2\u0DBB\u0DD3\u0DB8\u0DA7 \u0DB8\u0DD9\u0DB1\u0DCA? (What is good fertilizer for ginger?)",
            ]}
          />
          <TipBox>
            <strong>\u0DC3\u0DD2\u0D82\u0DC4\u0DBD\u0DD9\u0DB1\u0DCA \u0D85\u0DC4\u0DB1\u0DCA\u0DB1:</strong> \u0DB8\u0DDA \u0D8B\u0DB4\u0DAF\u0DD9\u0DC3\u0DCA \u0DC3\u0DDA\u0DC0\u0DCF\u0DC0\u0DD9\u0DB1\u0DCA \u0DC4\u0DDC\u0DB3\u0DB8 \u0D8B\u0DAD\u0DCA\u0DAD\u0DBB \u0DAF\u0DD9\u0DB1\u0DCA\u0DB1\u0DDA \u0DC3\u0DD2\u0D82\u0DC4\u0DBD\u0DD9\u0DB1\u0DCA, \u0DB8\u0DDC\u0D9A\u0DAF \u0DAF\u0DD0\u0DB1\u0DD4\u0DB8\u0DCA \u0DB4\u0DAF\u0DB1\u0DB8\u0DDA \u0DC3\u0DD2\u0D82\u0DC4\u0DBD \u0D9A\u0DD8\u0DC2\u0DD2\u0D9A\u0DCF\u0DBB\u0DCA\u0DB8\u0DD2\u0D9A \u0DAD\u0DDC\u0DBB\u0DAD\u0DD4\u0DBB\u0DD4\u0DAD\u0DCA \u0DAD\u0DD2\u0DBA\u0DD9\u0DB1 \u0DB1\u0DD2\u0DC3\u0DCF. \u0D94\u0DBA\u0DCF\u0DA7 \u0D89\u0D82\u0D9C\u0DCA\u200D\u0DBB\u0DD3\u0DC3\u0DD2\u0DBA\u0DD9\u0DB1\u0DCA \u0D85\u0DC4\u0DB1\u0DCA\u0DB1\u0DAD\u0DCA \u0DB4\u0DD4\u0DC5\u0DD4\u0DC0\u0DB1\u0DCA.
          </TipBox>
        </>
      ),
    },
    /* ---------- 7 ---------- */
    {
      number: 7,
      title: "\u0D9A\u0DCF\u0DBD\u0D9C\u0DD4\u0DAB \u0D85\u0DB1\u0DCF\u0DC0\u0DD0\u0D9A\u0DD2 \u0DC3\u0DC4 \u0D87\u0D9F\u0DC0\u0DD3\u0DB8\u0DCA",
      content: (
        <>
          <Paragraph>
            GoviHub \u0D91\u0D9A\u0DD9\u0DB1\u0DCA \u0DAF\u0DC0\u0DC3\u0DCA 5\u0D9A \u0D9A\u0DCF\u0DBD\u0D9C\u0DD4\u0DAB \u0D85\u0DB1\u0DCF\u0DC0\u0DD0\u0D9A\u0DD2 \u0D94\u0DBA\u0DCF\u0D9C\u0DDA \u0D9C\u0DDC\u0DC0\u0DD2\u0DB4\u0DDC\u0DC5 \u0DAD\u0DD2\u0DBA\u0DD9\u0DB1 \u0DAD\u0DD0\u0DB1\u0DA7 \u0DC4\u0DBB\u0DD2\u0DBA\u0DA7\u0DB8 \u0D9C\u0DD0\u0DBD\u0DB4\u0DD9\u0DB1\u0DCA\u0DB1 \u0DAF\u0DD9\u0DB1\u0DC0\u0DCF, \u0D91 \u0DC0\u0D9C\u0DDA\u0DB8 \u0D94\u0DBA\u0DCF\u0D9C\u0DDA \u0D9A\u0DD4\u0DC5\u0DD4\u0DB6\u0DA9\u0DD4 \u0DC0\u0D9C\u0DCF\u0DC0\u0DB1\u0DCA\u0DA7 \u0DC0\u0DD2\u0DC1\u0DDA\u0DC2 \u0D8B\u0DB4\u0DAF\u0DD9\u0DC3\u0DCA \u0D91\u0D9A\u0DCA\u0D9A.
          </Paragraph>

          <SubHeading>7.1 \u0D9A\u0DCF\u0DBD\u0D9C\u0DD4\u0DAB Dashboard Card \u0D91\u0D9A</SubHeading>
          <Paragraph>
            \u0D94\u0DBA\u0DCF\u0D9C\u0DDA Dashboard \u0D91\u0D9A\u0DDA \u0D85\u0DAF \u0DAF\u0DC0\u0DC3\u0DDA \u0D9A\u0DCF\u0DBD\u0D9C\u0DD4\u0DAB \u0DC3\u0DCF\u0DBB\u0DCF\u0D82\u0DC1\u0DBA \u0DB4\u0DD9\u0DB1\u0DCA\u0DB1\u0DB1\u0DC0\u0DCF: \u0D8B\u0DC2\u0DCA\u0DAB\u0DAD\u0DCA\u0DC0\u0DBA, \u0D86\u0DBB\u0DCA\u0DAF\u0DCA\u200D\u0DBB\u0DAD\u0DCF\u0DC0\u0DBA, \u0DC3\u0DD4\u0DC5\u0D9F\u0DDA \u0DC0\u0DDA\u0D9C\u0DBA \u0DC3\u0DC4 \u0DC0\u0DD0\u0DC3\u0DCA\u0DC3 \u0D91\u0DB1\u0DCA\u0DB1 \u0DAD\u0DD2\u0DBA\u0DD9\u0DB1 \u0D89\u0DA9\u0D9A\u0DA9. \u0DB8\u0DD4\u0DBD\u0DCA \u0DAF\u0DC0\u0DC3\u0DCA 3 &apos;\u0DC0\u0DD2\u0DC1\u0DCA\u0DC0\u0DCF\u0DC3\u0DAF\u0DCF\u0DBA\u0D9A\u0DBA\u0DD2&apos; \u0D9A\u0DD2\u0DBA\u0DBD\u0DCF \u0DC3\u0DBD\u0D9A\u0DB1\u0DC0\u0DCF, \u0D89\u0DAD\u0DD4\u0DBB\u0DD4 \u0DAF\u0DC0\u0DC3\u0DCA &apos;\u0D85\u0DB1\u0DCF\u0D9C\u0DAD \u0DAF\u0DD0\u0D9A\u0DCA\u0DB8\u0D9A\u0DCA&apos; \u0DC0\u0DD2\u0DAF\u0DD2\u0DC4\u0DA7.
          </Paragraph>

          <SubHeading>7.2 \u0DC3\u0DC0\u0DD2\u0DC3\u0DCA\u0DAD\u0DBB\u0DCF\u0DAD\u0DCA\u0DB8\u0D9A \u0D85\u0DB1\u0DCF\u0DC0\u0DD0\u0D9A\u0DD2\u0DBA</SubHeading>
          <Paragraph>
            \u0D9A\u0DCF\u0DBD\u0D9C\u0DD4\u0DAB card \u0D91\u0D9A touch \u0D9A\u0DBB\u0DB1\u0DCA\u0DB1 \u0DB1\u0DD0\u0DAD\u0DCA\u0DB1\u0DB8\u0DCA menu \u0D91\u0D9A\u0DD9\u0DB1\u0DCA Weather \u0DC0\u0DBD\u0DA7 \u0D9C\u0DD2\u0DC4\u0DD2\u0DB1\u0DCA \u0DB6\u0DBD\u0DB1\u0DCA\u0DB1 \u0DB4\u0DD4\u0DC5\u0DD4\u0DC0\u0DB1\u0DCA:
          </Paragraph>
          <BulletList
            items={[
              "\u0DAF\u0DC0\u0DC3\u0DCA 5\u0D9A \u0D85\u0DB1\u0DCF\u0DC0\u0DD0\u0D9A\u0DD2\u0DBA, \u0DAF\u0DC0\u0DC3\u0DA7 \u0D8B\u0DB4\u0DBB\u0DD2\u0DB8/\u0D85\u0DC0\u0DB8 \u0D8B\u0DC2\u0DCA\u0DAB\u0DAD\u0DCA\u0DC0\u0DBA \u0D91\u0D9A\u0DCA\u0D9A",
              "\u0D95\u0DB1\u0DD0\u0DB8 \u0DAF\u0DC0\u0DC3\u0D9A \u0DB4\u0DD0\u0DBA\u0D9A\u0DA7 \u0DC0\u0DBB\u0D9A\u0DCA \u0DC0\u0DD2\u0DC3\u0DCA\u0DAD\u0DBB (\u0DAF\u0DC0\u0DC3\u0D9A\u0DCA touch \u0D9A\u0DBB\u0DBD\u0DCF \u0DC0\u0DD0\u0DA9\u0DD2 \u0DC0\u0DD2\u0DC3\u0DCA\u0DAD\u0DBB \u0DB6\u0DBD\u0DB1\u0DCA\u0DB1)",
              "\u0DB4\u0DC3\u0DDA \u0D8B\u0DC2\u0DCA\u0DAB\u0DAD\u0DCA\u0DC0\u0DBA \u0DC3\u0DC4 \u0DAD\u0DD9\u0DAD\u0DB8\u0DB1\u0DBA \u0DB4\u0DD2\u0DC5\u0DD2\u0DB6\u0DB3 \u0DAF\u0DAD\u0DCA\u0DAD (\u0D9A\u0DC4, \u0D89\u0D9F\u0DD4\u0DBB\u0DD4 \u0DC0\u0D9C\u0DDA \u0DC0\u0D9C\u0DCF\u0DC0\u0DB1\u0DCA\u0DA7 \u0DB8\u0DDA\u0D9A \u0DC4\u0DBB\u0DD2\u0DB8 \u0DC0\u0DD0\u0DAF\u0D9C\u0DAD\u0DCA)",
              "\u0D86\u0DBB\u0DCA\u0DAF\u0DCA\u200D\u0DBB\u0DAD\u0DCF\u0DC0\u0DBA \u0DC3\u0DC4 \u0DC3\u0DD4\u0DC5\u0D9F\u0DDA \u0DC0\u0DDA\u0D9C\u0DBA \u0DB4\u0DD9\u0DB1\u0DCA\u0DB1\u0DB1 charts",
            ]}
          />

          <SubHeading>7.3 \u0D9A\u0DCF\u0DBD\u0D9C\u0DD4\u0DAB \u0D87\u0D9F\u0DC0\u0DD3\u0DB8\u0DCA</SubHeading>
          <Paragraph>
            GoviHub \u0D91\u0D9A \u0D94\u0DBA\u0DCF\u0D9C\u0DDA \u0DC0\u0D9C\u0DCF\u0DC0\u0DBD\u0DA7 \u0D85\u0DAF\u0DCF\u0DC5 \u0DC0\u0DD2\u0DC3\u0DCA\u0DAD\u0DBB \u0D91\u0D9A\u0DCA\u0D9A \u0D9A\u0DCF\u0DBD\u0D9C\u0DD4\u0DAB \u0DAD\u0DAD\u0DCA\u0DAD\u0DCA\u0DC0\u0DBA\u0DB1\u0DCA \u0DB1\u0DD2\u0DBB\u0DD3\u0D9A\u0DCA\u0DC2\u0DAB\u0DBA \u0D9A\u0DBB\u0DB1\u0DC0\u0DCF, \u0DC3\u0DC4 \u0DB8\u0DDA \u0DC0\u0D9C\u0DDA \u0DC0\u0DD9\u0DBD\u0DCF\u0DC0\u0DA7 \u0DC3\u0DCA\u0DC0\u0DBA\u0D82\u0D9A\u0DCA\u200D\u0DBB\u0DD3\u0DBA\u0DC0 \u0D87\u0D9F\u0DC0\u0DD3\u0DB8\u0DCA \u0D91\u0DC0\u0DCF\u0DC0\u0DD2:
          </Paragraph>
          <BulletList
            items={[
              "\u0D85\u0DB0\u0DD2\u0D9A \u0DC0\u0DD0\u0DC3\u0DCA\u0DC3\u0D9A\u0DCA \u0DB1\u0DD2\u0DC3\u0DCF \u0DA2\u0DBD\u0DC0\u0DC4\u0DB1\u0DBA\u0DA7 \u0DB4\u0DCA\u200D\u0DBB\u0DC1\u0DCA\u0DB1 \u0D87\u0DAD\u0DD2\u0DC0\u0DD9\u0DB1\u0DCA\u0DB1 \u0DB4\u0DD4\u0DC5\u0DD4\u0DC0\u0DB1\u0DCA \u0DB1\u0DB8\u0DCA (\u0DC0\u0DD2\u0DC1\u0DDA\u0DC2\u0DBA\u0DD9\u0DB1\u0DCA\u0DB8 \u0D9C\u0DB8\u0DCA\u0DB8\u0DD2\u0DBB\u0DD2\u0DC3\u0DCA, \u0D89\u0D9F\u0DD4\u0DBB\u0DD4 \u0DC0\u0D9C\u0DDA \u0DC0\u0D9C\u0DCF\u0DC0\u0DBD\u0DA7)",
              "\u0D94\u0DBA\u0DCF\u0D9C\u0DDA \u0DC0\u0D9C\u0DCF\u0DC0\u0DBD\u0DA7 \u0D85\u0DC4\u0DD2\u0DAD\u0D9A\u0DBB \u0DC0\u0DD2\u0DAF\u0DD2\u0DC4\u0DA7 \u0D8B\u0DC2\u0DCA\u0DAB\u0DAD\u0DCA\u0DC0\u0DBA \u0D85\u0DA9\u0DD4 \u0DC0\u0DD4\u0DAB\u0DDC\u0DAD\u0DCA",
              "\u0DAD\u0DAF \u0DC3\u0DD4\u0DC5\u0D82 \u0DB1\u0DD2\u0DC3\u0DCF \u0D9C\u0DB8\u0DCA\u0DB8\u0DD2\u0DBB\u0DD2\u0DC3\u0DCA \u0DC0\u0D9C\u0DDA \u0DC0\u0DD0\u0DBD\u0DCA \u0DC0\u0D9C\u0DCF\u0DC0\u0DBD\u0DA7 \u0DC4\u0DCF\u0DB1\u0DD2 \u0DC0\u0DD9\u0DB1\u0DCA\u0DB1 \u0DB4\u0DD4\u0DC5\u0DD4\u0DC0\u0DB1\u0DCA \u0DB1\u0DB8\u0DCA",
              "\u0DB4\u0DC3\u0DDA \u0DAD\u0DD9\u0DAD\u0DB8\u0DB1\u0DBA \u0D9C\u0DD0\u0DB1 \u0D85\u0DC0\u0DB0\u0DCF\u0DB1\u0DBA \u0DBA\u0DDC\u0DB8\u0DD4 \u0D9A\u0DBB\u0DB1\u0DCA\u0DB1 \u0D95\u0DB1 \u0DB1\u0DB8\u0DCA",
            ]}
          />
          <Paragraph>
            \u0DC4\u0DD0\u0DB8 \u0D87\u0D9F\u0DC0\u0DD3\u0DB8\u0D9A\u0DCA\u0DB8 \u0DC3\u0DD2\u0D82\u0DC4\u0DBD\u0DD9\u0DB1\u0DCA \u0D91\u0DB1\u0DC0\u0DCF, \u0D91 \u0DC0\u0D9C\u0DDA\u0DB8 \u0D94\u0DBA\u0DCF \u0D9A\u0DBB\u0DB1\u0DCA\u0DB1 \u0D95\u0DB1 \u0DC0\u0DD2\u0DC1\u0DDA\u0DC2 \u0DC0\u0DD0\u0DA9\u0D9A\u0DCA \u0D91\u0D9A\u0DCA\u0D9A (\u0D8B\u0DAF\u0DCF\u0DC4\u0DBB\u0DAB\u0DBA\u0D9A\u0DCA \u0DC0\u0DD2\u0DAF\u0DD2\u0DC4\u0DA7, &quot;\u0DA2\u0DBD\u0DC0\u0DC4\u0DB1 \u0DB8\u0DCF\u0DBB\u0DCA\u0D9C \u0DB4\u0DD2\u0DBB\u0DD2\u0DC3\u0DD2\u0DAF\u0DD4 \u0D9A\u0DBB\u0DB1\u0DCA\u0DB1&quot;).
          </Paragraph>
        </>
      ),
    },
    /* ---------- 8 ---------- */
    {
      number: 8,
      title: "\u0DC3\u0DD0\u0DB4\u0DBA\u0DD4\u0DB8\u0DCA \u0DC0\u0DD9\u0DC5\u0DB3\u0DB4\u0DDC\u0DC5",
      content: (
        <>
          <Paragraph>
            \u0DC0\u0DD2\u0DC1\u0DCA\u0DC0\u0DCF\u0DC3\u0DC0\u0DB1\u0DCA\u0DAD \u0DC3\u0DD0\u0DB4\u0DBA\u0DD4\u0DB8\u0DCA\u0D9A\u0DBB\u0DD4\u0DC0\u0DB1\u0DCA \u0DAF\u0DCF\u0DBD\u0DCF \u0DAD\u0DD2\u0DBA\u0DD9\u0DB1, \u0D9C\u0DDC\u0DC0\u0DD2\u0DAD\u0DD0\u0DB1\u0DA7 \u0D95\u0DB1 \u0D9A\u0DBB\u0DB1 \u0DB6\u0DD3\u0DA2, \u0DB4\u0DDC\u0DC4\u0DDC\u0DBB, \u0D8B\u0DB4\u0D9A\u0DBB\u0DAB \u0DC3\u0DC4 \u0DBA\u0DB1\u0DCA\u0DAD\u0DCA\u200D\u0DBB \u0DC3\u0DD6\u0DAD\u0DCA\u200D\u0DBB \u0DC0\u0D9C\u0DDA \u0DAF\u0DDA\u0DC0\u0DBD\u0DCA \u0DB6\u0DBD\u0DBD\u0DCF \u0DC0\u0DD2\u0DC3\u0DCA\u0DAD\u0DBB \u0D85\u0DC4\u0DB1\u0DCA\u0DB1 \u0DB4\u0DD4\u0DC5\u0DD4\u0DC0\u0DB1\u0DCA.
          </Paragraph>
          <StepTable
            steps={[
              { step: 1, action: "\u0DC0\u0DD9\u0DC5\u0DB3\u0DB4\u0DDC\u0DC5\u0DA7 \u0DBA\u0DB1\u0DCA\u0DB1", details: "\u0DB8\u0DD9\u0DB1\u0DD4 \u0D91\u0D9A\u0DD9\u0DB1\u0DCA \u201C\u0DC0\u0DD9\u0DC5\u0DB3\u0DB4\u0DDC\u0DC5\u201D \u0D9A\u0DD2\u0DBA\u0DB1 \u0D91\u0D9A \u0D94\u0DB6\u0DB1\u0DCA\u0DB1" },
              { step: 2, action: "\u0DB6\u0DBD\u0DB1\u0DCA\u0DB1 \u0DB1\u0DD0\u0DAD\u0DCA\u0DB1\u0DB8\u0DCA \u0DC4\u0DDC\u0DBA\u0DB1\u0DCA\u0DB1", details: "\u0DC0\u0DBB\u0DCA\u0D9C\u0DBA \u0D85\u0DB1\u0DD4\u0DC0 (\u0DB6\u0DD3\u0DA2, \u0DB4\u0DDC\u0DC4\u0DDC\u0DBB, \u0D8B\u0DB4\u0D9A\u0DBB\u0DAB) \u0DB4\u0DD2\u0DBD\u0DCA\u0DA7\u0DBB\u0DCA \u0D9A\u0DBB\u0DB1\u0DCA\u0DB1 \u0DB1\u0DD0\u0DAD\u0DCA\u0DB1\u0DB8\u0DCA \u0DC0\u0DA0\u0DB1\u0DBA\u0D9A\u0DCA \u0DAF\u0DCF\u0DBD\u0DCF \u0DC4\u0DDC\u0DBA\u0DB1\u0DCA\u0DB1" },
              { step: 3, action: "\u0DC0\u0DD2\u0DC3\u0DCA\u0DAD\u0DBB \u0DB6\u0DBD\u0DB1\u0DCA\u0DB1", details: "\u0D95\u0DB1\u0DD0\u0DB8 \u0DAF\u0DD0\u0DB1\u0DCA\u0DC0\u0DD3\u0DB8\u0D9A\u0DCA \u0D94\u0DB6\u0DBD\u0DCF \u0DB8\u0DD2\u0DBD, \u0DAD\u0DD2\u0DBA\u0DD9\u0DB1 \u0DB4\u0DCA\u200D\u0DBB\u0DB8\u0DCF\u0DAB\u0DBA, \u0DC3\u0DD0\u0DB4\u0DBA\u0DD4\u0DB8\u0DCA\u0D9A\u0DBB\u0DD4\u0D9C\u0DDA \u0DC0\u0DD2\u0DC3\u0DCA\u0DAD\u0DBB \u0DC3\u0DC4 \u0DB4\u0DDC\u0DA7\u0DDD \u0DB6\u0DBD\u0DB1\u0DCA\u0DB1" },
              { step: 4, action: "\u0DC3\u0DD0\u0DB4\u0DBA\u0DD4\u0DB8\u0DCA\u0D9A\u0DBB\u0DD4\u0DA7 \u0D9A\u0DAD\u0DCF \u0D9A\u0DBB\u0DB1\u0DCA\u0DB1", details: "\u0DB1\u0DD2\u0DC2\u0DCA\u0DB4\u0DCF\u0DAF\u0DB1\u0DBA \u0D9C\u0DD0\u0DB1 \u0DC3\u0DD0\u0DB4\u0DBA\u0DD4\u0DB8\u0DCA\u0D9A\u0DBB\u0DD4\u0DA7 \u0D9A\u0DAD\u0DCF \u0D9A\u0DBB\u0DB1\u0DCA\u0DB1 \u0DC0\u0DD2\u0DB8\u0DC3\u0DD3\u0DB8\u0DCA \u0DB6\u0DDC\u0DAD\u0DCA\u0DAD\u0DB8 \u0D94\u0DB6\u0DB1\u0DCA\u0DB1" },
            ]}
          />
        </>
      ),
    },
    /* ---------- 9 ---------- */
    {
      number: 9,
      title: "\u0DAF\u0DD0\u0DB1\u0DD4\u0DB8\u0DCA\u0DAF\u0DD3\u0DB8\u0DCA",
      content: (
        <>
          <Paragraph>GoviHub \u0D94\u0DBA\u0DCF\u0DA7 \u0DAF\u0DD0\u0DB1\u0DD4\u0DB8\u0DCA\u0DAF\u0DD3\u0DB8\u0DCA \u0D91\u0DC0\u0DB1\u0DCA\u0DB1\u0DDA \u0DB8\u0DDA \u0DAF\u0DDA\u0DC0\u0DBD\u0DCA \u0D9C\u0DD0\u0DB1\u0DBA\u0DD2:</Paragraph>
          <BulletList
            items={[
              "\u0D94\u0DBA\u0DCF\u0D9C\u0DDA \u0D85\u0DC3\u0DCA\u0DC0\u0DB1\u0DD4 \u0DAF\u0DD0\u0DB1\u0DCA\u0DC0\u0DD3\u0DB8\u0DCA \u0DC0\u0DBD\u0DA7 \u0D85\u0DBD\u0DD4\u0DAD\u0DCA \u0D9C\u0DD0\u0DB1\u0DD4\u0DB8\u0DCA\u0D9A\u0DBB\u0DD4\u0DC0\u0DB1\u0DCA \u0D9C\u0DD0\u0DBD\u0DB4\u0DD3\u0DB8\u0DCA (matches) \u0D9C\u0DD0\u0DB1",
              "\u0D9C\u0DD0\u0DBD\u0DB4\u0DD3\u0DB8\u0DCA \u0DC0\u0DBD \u0DAD\u0DAD\u0DCA\u0DAD\u0DCA\u0DC0 \u0DC0\u0DD9\u0DB1\u0DC3\u0DCA\u0DC0\u0DD3\u0DB8\u0DCA (\u0DB4\u0DD2\u0DC5\u0DD2\u0D9C\u0DAD\u0DCA\u0DAD\u0DCF, \u0D89\u0DC0\u0DBB\u0DBA\u0DD2 \u0DC0\u0D9C\u0DDA \u0DAF\u0DDA\u0DC0\u0DBD\u0DCA)",
              "\u0D94\u0DBA\u0DCF\u0D9C\u0DDA \u0DC0\u0D9C\u0DCF\u0DC0\u0DB1\u0DCA\u0DA7 \u0D9A\u0DCF\u0DBD\u0D9C\u0DD4\u0DAB \u0D85\u0DB1\u0DAD\u0DD4\u0DBB\u0DD4 \u0D87\u0D9F\u0DC0\u0DD3\u0DB8\u0DCA",
              "GoviHub \u0DB4\u0DBB\u0DD2\u0DB4\u0DCF\u0DBD\u0D9A\u0DBA\u0DD2\u0DB1\u0DCA\u0D9C\u0DD9\u0DB1\u0DCA \u0D91\u0DB1 \u0DB4\u0DDC\u0DAF\u0DD4 \u0DB1\u0DD2\u0DC0\u0DDA\u0DAF\u0DB1",
            ]}
          />
          <Paragraph>
            \u0D94\u0DBA\u0DCF\u0D9C\u0DDA Dashboard \u0D91\u0D9A\u0DDA \u0DAD\u0DD2\u0DBA\u0DD9\u0DB1 \u0DAF\u0DD0\u0DB1\u0DD4\u0DB8\u0DCA\u0DAF\u0DD3\u0DB8\u0DCA \u0DC3\u0DD3\u0DB1\u0DD4\u0DC0\u0DD9\u0DB1\u0DCA, \u0D94\u0DBA\u0DCF \u0DB1\u0DDC\u0DB6\u0DBD\u0DB4\u0DD4 \u0DAF\u0DD0\u0DB1\u0DD4\u0DB8\u0DCA\u0DAF\u0DD3\u0DB8\u0DCA \u0D9A\u0DD3\u0DBA\u0D9A\u0DCA \u0DAD\u0DD2\u0DBA\u0DD9\u0DB1\u0DC0\u0DAF \u0D9A\u0DD2\u0DBA\u0DBD\u0DCF \u0DB4\u0DD9\u0DB1\u0DCA\u0DB1\u0DB1\u0DC0\u0DCF. \u0D91\u0D9A \u0D94\u0DB6\u0DBD\u0DCF \u0DC4\u0DD0\u0DB8 \u0DAF\u0DD0\u0DB1\u0DD4\u0DB8\u0DCA\u0DAF\u0DD3\u0DB8\u0D9A\u0DCA\u0DB8 \u0DB6\u0DBD\u0DB1\u0DCA\u0DB1 \u0DB4\u0DD4\u0DC5\u0DD4\u0DC0\u0DB1\u0DCA. \u0D91 \u0DC0\u0D9C\u0DDA\u0DB8 \u0D91\u0D9A\u0DD2\u0DB1\u0DCA \u0D91\u0D9A \u0DC4\u0DDD \u0D91\u0D9A\u0DB4\u0DCF\u0DBB\u0DA7\u0DB8 \u0D9A\u0DD2\u0DBA\u0DD9\u0DC0\u0DCA\u0DC0\u0DCF \u0D9A\u0DD2\u0DBA\u0DBD\u0DCF \u0DC3\u0DBD\u0D9A\u0DD4\u0DAB\u0DD4 \u0D9A\u0DBB\u0DB1\u0DCA\u0DB1\u0DAD\u0DCA \u0DB4\u0DD4\u0DC5\u0DD4\u0DC0\u0DB1\u0DCA.
          </Paragraph>
        </>
      ),
    },
    /* ---------- 10 ---------- */
    {
      number: 10,
      title: "\u0DC3\u0DD0\u0D9A\u0DC3\u0DD4\u0DB8\u0DCA \u0DC3\u0DC4 \u0DB4\u0DD0\u0DAD\u0DD2\u0D9A\u0DA9",
      content: (
        <>
          <SubHeading>10.1 \u0DB4\u0DD0\u0DAD\u0DD2\u0D9A\u0DA9 \u0DC3\u0DD0\u0D9A\u0DC3\u0DD4\u0DB8\u0DCA</SubHeading>
          <Paragraph>
            \u0D94\u0DB6\u0DDA \u0DB4\u0DD8\u0DAF\u0DCA\u0D9C\u0DBD\u0DD2\u0D9A \u0DAD\u0DDC\u0DBB\u0DAD\u0DD4\u0DBB\u0DD4 \u0D85\u0DBD\u0DD4\u0DAD\u0DCA \u0D9A\u0DBB\u0D9C\u0DB1\u0DCA\u0DB1: \u0DC3\u0DB8\u0DCA\u0DB4\u0DD6\u0DBB\u0DCA\u0DAB \u0DB1\u0DB8, \u0DAF\u0DD4\u0DBB\u0D9A\u0DAD\u0DB1 \u0D85\u0D82\u0D9A\u0DBA, \u0DAF\u0DD2\u0DC3\u0DCA\u0DAD\u0DCA\u200D\u0DBB\u0DD2\u0D9A\u0DCA\u0D9A\u0DBA \u0DC3\u0DC4 \u0DC3\u0DCA\u0DAD\u0DCF\u0DB1\u0DBA, \u0D89\u0DA9\u0DB8\u0DDA \u0DB4\u0DCA\u200D\u0DBB\u0DB8\u0DCF\u0DAB\u0DBA, \u0DC3\u0DC4 \u0D9C\u0DDC\u0DC0\u0DD2\u0DAD\u0DD0\u0DB1\u0DCA \u0D85\u0DAD\u0DCA\u0DAF\u0DD0\u0D9A\u0DD3\u0DB8\u0DCA.
          </Paragraph>

          <SubHeading>10.2 \u0DB6\u0DDD\u0D9C \u0DAD\u0DDD\u0DBB\u0DCF\u0D9C\u0DD0\u0DB1\u0DD3\u0DB8</SubHeading>
          <Paragraph>
            \u0D94\u0DB6\u0DDA \u0DB4\u0DD0\u0DAD\u0DD2\u0D9A\u0DA9\u0DA7 \u0D9A\u0DD4\u0DC5\u0DD4\u0DB6\u0DA9\u0DD4 \u0DB6\u0DDD\u0D9C \u0D91\u0D9A\u0DAD\u0DD4 \u0D9A\u0DBB\u0DB1\u0DCA\u0DB1 \u0DC4\u0DDD \u0D89\u0DC0\u0DAD\u0DCA \u0D9A\u0DBB\u0DB1\u0DCA\u0DB1, \u0D91 \u0DC3\u0DB3\u0DC4\u0DCF \u0DC3\u0DD0\u0D9A\u0DC3\u0DD4\u0DB8\u0DCA &gt; \u0DB8\u0D9C\u0DDA \u0DB6\u0DDD\u0D9C \u0DC0\u0DBD\u0DA7 \u0DBA\u0DB1\u0DCA\u0DB1. \u0DB8\u0DDA\u0D9A\u0DD9\u0DB1\u0DCA \u0DB6\u0DBD\u0DB4\u0DCF\u0DB1\u0DC0\u0DCF \u0D94\u0DB6\u0DA7 \u0DBD\u0DD0\u0DB6\u0DD9\u0DB1 \u0D9A\u0DCF\u0DBD\u0D9C\u0DD4\u0DAB \u0D85\u0DB1\u0DAD\u0DD4\u0DBB\u0DD4 \u0D87\u0D9F\u0DC0\u0DD3\u0DB8\u0DCA \u0DB8\u0DDC\u0DB1\u0DC0\u0DAF, \u0DC0\u0D9C\u0DDA\u0DB8 \u0D94\u0DB6\u0DA7 \u0D9C\u0DD0\u0DBD\u0DB4\u0DD9\u0DB1 \u0D9C\u0DD0\u0DB1\u0DD4\u0DB8\u0DCA\u0D9A\u0DBB\u0DD4\u0DC0\u0DDD \u0D9A\u0DC0\u0DD4\u0DAF \u0D9A\u0DD2\u0DBA\u0DBD\u0DCF.
          </Paragraph>

          <SubHeading>10.3 \u0DAF\u0DD0\u0DB1\u0DD4\u0DB8\u0DCA\u0DAF\u0DD3\u0DB8\u0DCA \u0D9A\u0DD0\u0DB8\u0DD0\u0DAD\u0DCA\u0DAD</SubHeading>
          <Paragraph>
            \u0D94\u0DB6\u0DA7 \u0DBD\u0DD0\u0DB6\u0DD9\u0DB1 \u0DAF\u0DD0\u0DB1\u0DD4\u0DB8\u0DCA\u0DAF\u0DD3\u0DB8\u0DCA \u0DB4\u0DCF\u0DBD\u0DB1\u0DBA \u0D9A\u0DBB\u0DB1\u0DCA\u0DB1. \u0D9C\u0DD0\u0DBD\u0DB4\u0DD3\u0DB8\u0DCA, \u0D9A\u0DCF\u0DBD\u0D9C\u0DD4\u0DAB\u0DBA, \u0DB8\u0DD2\u0DBD \u0D9C\u0DAB\u0DB1\u0DCA, \u0DC3\u0DC4 \u0DB1\u0DD2\u0DC0\u0DDA\u0DAF\u0DB1 \u0DC3\u0DB3\u0DC4\u0DCF \u0D85\u0DB1\u0DAD\u0DD4\u0DBB\u0DD4 \u0D87\u0D9F\u0DC0\u0DD3\u0DB8\u0DCA \u0DC3\u0D9A\u0DCA\u200D\u0DBB\u0DD3\u0DBA \u0D9A\u0DBB\u0DB1\u0DCA\u0DB1 \u0DC4\u0DDD \u0D85\u0D9A\u0DCA\u200D\u0DBB\u0DD3\u0DBA \u0D9A\u0DBB\u0DB1\u0DCA\u0DB1 \u0DB4\u0DD4\u0DC5\u0DD4\u0DC0\u0DB1\u0DCA.
          </Paragraph>

          <SubHeading>10.4 \u0DB8\u0DD4\u0DBB\u0DB4\u0DAF\u0DBA \u0DC0\u0DD9\u0DB1\u0DC3\u0DCA \u0D9A\u0DBB\u0DB1\u0DCA\u0DB1</SubHeading>
          <Paragraph>
            \u0DC3\u0DD0\u0D9A\u0DC3\u0DD4\u0DB8\u0DCA &gt; \u0DB8\u0DD4\u0DBB\u0DB4\u0DAF\u0DBA \u0DC0\u0DD9\u0DB1\u0DC3\u0DCA \u0D9A\u0DBB\u0DB1\u0DCA\u0DB1 \u0D9A\u0DD2\u0DBA\u0DB1 \u0DAD\u0DD0\u0DB1\u0DA7 \u0DBA\u0DB1\u0DCA\u0DB1. \u0D85\u0DBD\u0DD4\u0DAD\u0DCA \u0DB8\u0DD4\u0DBB\u0DB4\u0DAF\u0DBA\u0D9A\u0DCA \u0DAF\u0DCF\u0DB1\u0DCA\u0DB1 \u0DB1\u0DB8\u0DCA, \u0D94\u0DB6\u0DA7 \u0DAF\u0DD0\u0DB1\u0DA7 \u0DAD\u0DD2\u0DBA\u0DD9\u0DB1 \u0DB8\u0DD4\u0DBB\u0DB4\u0DAF\u0DBA \u0D95\u0DB1 \u0DC0\u0DD9\u0DB1\u0DC0\u0DCF.
          </Paragraph>
        </>
      ),
    },
    /* ---------- 11 ---------- */
    {
      number: 11,
      title: "\u0D85\u0DAF\u0DC4\u0DC3\u0DCA \u0DAF\u0DD9\u0DB1\u0DCA\u0DB1",
      content: (
        <>
          <Paragraph>
            GoviHub \u0DC4\u0DDC\u0DB3 \u0D9A\u0DBB\u0DB1\u0DCA\u0DB1 \u0D85\u0DB4\u0DD2\u0DA7 \u0D8B\u0DAF\u0DC0\u0DD4 \u0D9A\u0DBB\u0DB1\u0DCA\u0DB1! More menu \u0D91\u0D9A\u0DA7 \u0D9C\u0DD2\u0DC4\u0DD2\u0DB1\u0DCA &quot;Feedback&quot; \u0D9A\u0DD2\u0DBA\u0DB1 \u0D91\u0D9A \u0D94\u0DB6\u0DBD\u0DCF \u0D94\u0DBA\u0DCF\u0DBD\u0D9C\u0DDA \u0D85\u0DAF\u0DC4\u0DC3\u0DCA \u0D9A\u0DD2\u0DBA\u0DB1\u0DCA\u0DB1, \u0DC0\u0DD0\u0DBB\u0DAF\u0DD2 \u0DAD\u0DD2\u0DBA\u0DD9\u0DB1\u0DC0\u0DCF \u0DB1\u0DB8\u0DCA \u0D9A\u0DD2\u0DBA\u0DB1\u0DCA\u0DB1, \u0DB1\u0DD0\u0DAD\u0DCA\u0DB1\u0DB8\u0DCA \u0D85\u0DBD\u0DD4\u0DAD\u0DCA \u0DAF\u0DDA\u0DC0\u0DBD\u0DCA \u0D91\u0D9A\u0DAD\u0DD4 \u0D9A\u0DBB\u0DB1\u0DCA\u0DB1 \u0D9A\u0DD2\u0DBA\u0DBD\u0DCF \u0DBA\u0DDD\u0DA2\u0DB1\u0DCF \u0D9A\u0DBB\u0DB1\u0DCA\u0DB1 \u0DB4\u0DD4\u0DC5\u0DD4\u0DC0\u0DB1\u0DCA. \u0D94\u0DBA\u0DCF\u0DBD\u0DCF \u0DAF\u0DD9\u0DB1 \u0DC4\u0DD0\u0DB8 \u0D85\u0DAF\u0DC4\u0DC3\u0D9A\u0DCA\u0DB8 GoviHub \u0D9A\u0DAB\u0DCA\u0DA9\u0DCF\u0DBA\u0DB8 \u0D9A\u0DD2\u0DBA\u0DC0\u0DB1\u0DC0\u0DCF.
          </Paragraph>
        </>
      ),
    },
    /* ---------- 12 ---------- */
    {
      number: 12,
      title: "\u0D89\u0D9A\u0DCA\u0DB8\u0DB1\u0DCA \u0DC0\u0DD2\u0DC3\u0DCA\u0DAD\u0DBB",
      content: (
        <QuickRefTable
          headers={{ want: "\u0DB8\u0DA7 \u0D95\u0DB1...", goto: "\u0DBA\u0DB1\u0DCA\u0DB1 \u0D95\u0DB1..." }}
          rows={[
            { want: "\u0DB8\u0D9C\u0DDA \u0D85\u0DC3\u0DCA\u0DC0\u0DD0\u0DB1\u0DCA\u0DB1 \u0DC0\u0DD2\u0D9A\u0DD4\u0DAB\u0DB1\u0DCA\u0DB1", goto: "Listings > Create New" },
            { want: "\u0D9C\u0DD0\u0DB1\u0DD4\u0DB8\u0DCA\u0D9A\u0DBB\u0DD4\u0DC0\u0DB1\u0DCA \u0DC4\u0DDC\u0DBA\u0DB1\u0DCA\u0DB1", goto: "Matches (\u0DB4\u0DC4\u0DC5 \u0DAD\u0DD3\u0DBB\u0DD4\u0DC0\u0DDA)" },
            { want: "\u0D9A\u0DCF\u0DBD\u0D9C\u0DD4\u0DAB\u0DBA \u0DB6\u0DBD\u0DB1\u0DCA\u0DB1", goto: "Dashboard weather card \u0D91\u0D9A\u0DA7 \u0DB1\u0DD0\u0DAD\u0DCA\u0DB1\u0DB8\u0DCA Weather \u0DB4\u0DD2\u0DA7\u0DD4\u0DC0\u0DA7" },
            { want: "\u0DBD\u0DD9\u0DA9 \u0DC0\u0DD4\u0DAB \u0DB6\u0DDD\u0D9C\u0DBA\u0D9A\u0DCA \u0DC4\u0DB3\u0DD4\u0DB1\u0DCF\u0D9C\u0DB1\u0DCA\u0DB1", goto: "Diagnosis > Upload Photo" },
            { want: "\u0D9C\u0DDC\u0DC0\u0DD2\u0DAD\u0DD0\u0DB1 \u0D9C\u0DD0\u0DB1 \u0DB4\u0DCA\u200D\u0DBB\u0DC1\u0DCA\u0DB1\u0DBA\u0D9A\u0DCA \u0D85\u0DC4\u0DB1\u0DCA\u0DB1", goto: "Advisory" },
            { want: "\u0DB6\u0DD3\u0DA2/\u0DB4\u0DDC\u0DC4\u0DDC\u0DBB \u0D9C\u0DB1\u0DCA\u0DB1", goto: "Marketplace" },
            { want: "\u0DB8\u0D9C\u0DDA \u0DAF\u0DD0\u0DB1\u0DD4\u0DB8\u0DCA\u0DAF\u0DD3\u0DB8\u0DCA \u0DB6\u0DBD\u0DB1\u0DCA\u0DB1", goto: "Dashboard \u0D91\u0D9A\u0DDA Notification bell \u0D91\u0D9A\u0DA7" },
            { want: "\u0DB8\u0D9C\u0DDA \u0DB6\u0DDD\u0D9C \u0DC0\u0DD2\u0DC3\u0DCA\u0DAD\u0DBB \u0DBA\u0DCF\u0DC0\u0DAD\u0DCA\u0D9A\u0DCF\u0DBD\u0DD3\u0DB1 \u0D9A\u0DBB\u0DB1\u0DCA\u0DB1", goto: "Settings > My Crops" },
            { want: "\u0DB8\u0D9C\u0DDA \u0DB8\u0DD4\u0DBB\u0DB4\u0DAF\u0DBA \u0DC0\u0DD9\u0DB1\u0DC3\u0DCA \u0D9A\u0DBB\u0DB1\u0DCA\u0DB1", goto: "Settings > Change Password" },
            { want: "\u0D85\u0DAF\u0DC4\u0DC3\u0DCA \u0DAF\u0DD9\u0DB1\u0DCA\u0DB1", goto: "More > Feedback" },
          ]}
        />
      ),
    },
  ],
  help: {
    title: "\u0D8B\u0DAF\u0DC0\u0DD4 \u0D95\u0DB1\u0DD9\u0DAF?",
    items: [
      "\u0D95\u0DB1\u0DD0\u0DB8 \u0D9C\u0DDC\u0DC0\u0DD2\u0DAD\u0DD0\u0DB1\u0DCA \u0DB4\u0DCA\u200D\u0DBB\u0DC1\u0DCA\u0DB1\u0DBA\u0D9A\u0DCA \u0D85\u0DC4\u0DB1\u0DCA\u0DB1 AI \u0D9C\u0DDC\u0DC0\u0DD2 \u0D8B\u0DB4\u0DAF\u0DDA\u0DC1\u0D9A \u0DC3\u0DDA\u0DC0\u0DCF\u0DC0 \u0DB4\u0DCF\u0DC0\u0DD2\u0DA0\u0DCA\u0DA0\u0DD2 \u0D9A\u0DBB\u0DB1\u0DCA\u0DB1",
      "\u0D87\u0DB4\u0DCA \u0D91\u0D9A \u0DC4\u0DBB\u0DC4\u0DCF \u0DB4\u0DCA\u200D\u0DBB\u0DAD\u0DD2\u0DA0\u0DCF\u0DBB \u0DAF\u0DD9\u0DB1\u0DCA\u0DB1 (\u0DC0\u0DD0\u0DA9\u0DD2 \u0DC0\u0DD2\u0DC3\u0DCA\u0DAD\u0DBB > \u0DB4\u0DCA\u200D\u0DBB\u0DAD\u0DD2\u0DA0\u0DCF\u0DBB)",
      "\u0D94\u0DB6\u0DDA \u0DB4\u0DCA\u200D\u0DBB\u0DAF\u0DDA\u0DC1\u0DBA\u0DDA GoviHub \u0D9A\u0DCA\u0DC2\u0DDA\u0DAD\u0DCA\u200D\u0DBB \u0DC3\u0DB8\u0DCA\u0DB6\u0DB1\u0DCA\u0DB0\u0DD3\u0D9A\u0DBB\u0D9A\u0DC0 \u0DC3\u0DB8\u0DCA\u0DB6\u0DB1\u0DCA\u0DB0 \u0D9A\u0DBB\u0D9C\u0DB1\u0DCA\u0DB1",
    ],
  },
};

/* ------------------------------------------------------------------ */
/*  Page component                                                     */
/* ------------------------------------------------------------------ */

export default function FarmerGuidePage() {
  const { locale } = useParams();
  const [lang, setLang] = useState<string>((locale as string) || "en");
  const guide = lang === "si" ? si : en;

  return (
    <div className="min-h-screen bg-gray-50 print:bg-white">
      {/* ---------- Header ---------- */}
      <header className="bg-[#1A1A2E] text-white print:bg-white print:text-black">
        <div className="max-w-[720px] mx-auto px-4 py-6 flex items-center justify-between">
          <Link
            href={`/${locale || "en"}/learn`}
            className="text-green-300 hover:text-green-200 text-sm font-medium print:text-gray-600"
          >
            {guide.meta.backLabel}
          </Link>

          <div className="flex items-center gap-3">
            <button
              onClick={() => window.print()}
              className="text-xs px-3 py-1.5 rounded-full border border-white/30 hover:bg-white/10 transition print:hidden"
            >
              {guide.meta.printLabel}
            </button>
            <button
              onClick={() => setLang(lang === "en" ? "si" : "en")}
              className="text-xs px-3 py-1.5 rounded-full bg-[#E8A838] text-[#1A1A2E] font-bold hover:bg-[#d4962f] transition print:hidden"
            >
              {guide.meta.langToggleLabel}
            </button>
          </div>
        </div>
      </header>

      {/* ---------- Title Banner ---------- */}
      <div className="bg-gradient-to-b from-[#1A1A2E] to-[#2D6A2E] text-white print:bg-white print:text-black">
        <div className="max-w-[720px] mx-auto px-4 pt-2 pb-10 text-center">
          <h1 className="text-2xl md:text-3xl font-extrabold mb-2">
            {guide.meta.title}
          </h1>
          <p className="text-green-200 text-sm print:text-gray-600">
            {guide.meta.subtitle}
          </p>
          <p className="text-green-300/70 text-xs mt-1 print:text-gray-500">
            {guide.meta.version}
          </p>
        </div>
      </div>

      {/* ---------- Body ---------- */}
      <main className="max-w-[720px] mx-auto px-4 py-8 print:py-4">
        {guide.sections.map((section) => (
          <section key={section.number} className="print:break-inside-avoid-page">
            <SectionHeading number={section.number} title={section.title} />
            {section.content}
            {section.number < 12 && (
              <hr className="my-8 border-gray-200 print:my-4" />
            )}
          </section>
        ))}

        {/* ---------- Need Help ---------- */}
        <div className="mt-12 p-6 bg-green-50 rounded-xl border border-green-200 print:break-inside-avoid">
          <h3 className="text-lg font-bold text-[#2D6A2E] mb-3">
            {guide.help.title}
          </h3>
          <BulletList items={guide.help.items} />
        </div>

        {/* ---------- YouTube Banner ---------- */}
        <div className="mt-8 p-6 bg-red-50 rounded-xl border border-red-200 text-center print:hidden">
          <div className="text-3xl mb-2">&#x25B6;&#xFE0F;</div>
          <p className="text-gray-700 font-medium mb-1">
            {guide.meta.youtubeText}
          </p>
          <a
            href="https://youtube.com/@GoviHubSriLanka"
            target="_blank"
            rel="noopener noreferrer"
            className="text-red-600 font-bold hover:underline"
          >
            {guide.meta.youtubeChannel}
          </a>
        </div>

        {/* ---------- CTA ---------- */}
        <div className="mt-10 mb-8 text-center print:hidden">
          <Link
            href={`/${locale || "en"}/auth/beta-login`}
            className="inline-block px-8 py-3 rounded-full bg-[#2D6A2E] text-white font-bold text-lg hover:bg-green-800 transition shadow-lg hover:shadow-xl"
          >
            {guide.meta.ctaButton}
          </Link>
        </div>

        {/* ---------- Footer ---------- */}
        <footer className="mt-12 pt-6 border-t border-gray-200 text-center text-xs text-gray-500 pb-8">
          <p className="italic">{guide.meta.footer}</p>
          <p className="mt-1">{guide.meta.footerOrg}</p>
        </footer>
      </main>
    </div>
  );
}
