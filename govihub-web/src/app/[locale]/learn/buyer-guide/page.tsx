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
    title: "GoviHub Spices \u2014 Buyer User Guide",
    subtitle: "Sri Lanka\u2019s AI Spice Marketplace",
    version: "Version 1.0 \u2014 April 2026",
    backLabel: "\u2190 Back to Learn",
    langToggleLabel: "SI",
    printLabel: "Print",
    ctaButton: "Get Started with GoviHub",
    youtubeText: "Watch video tutorials on our YouTube channel",
    youtubeChannel: "@GoviHubSriLanka",
    footer:
      "GoviHub Spices \u2014 Connecting Sri Lankan spice buyers directly to farmers through AI",
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
            GoviHub Spices connects you directly to Sri Lankan spice farmers
            &mdash; no middlemen, no agents, no wasted trips. Post what you need,
            and GoviHub&apos;s AI matching engine finds the right farmers for you.
          </Paragraph>

          <SubHeading>1.1 What You Need</SubHeading>
          <BulletList
            items={[
              "A smartphone or computer with internet access",
              "Chrome, Safari, or any modern web browser",
            ]}
          />
          <TipBox>
            <strong>Install as App:</strong> Visit spices.govihublk.com in Chrome
            and tap &quot;Add to Home Screen&quot; to install GoviHub as an app on
            your phone.
          </TipBox>

          <SubHeading>1.2 Creating Your Account</SubHeading>
          <StepTable
            steps={[
              { step: 1, action: "Open GoviHub", details: "Go to spices.govihublk.com in your browser" },
              { step: 2, action: "Tap Register", details: 'On the landing page, tap the "Register" button' },
              { step: 3, action: "Enter Your Details", details: "Username, password, full name, phone number, and district" },
              { step: 4, action: "Select Your Role", details: 'Choose "Buyer" as your role' },
              { step: 5, action: "Complete Your Profile", details: "Enter your business name, buying capacity, and preferred crops" },
              { step: 6, action: "Set Your Location", details: "Allow GPS access or enter your district. This is used to match you with nearby farmers" },
              { step: 7, action: "Done!", details: "You will be taken to your Buyer Dashboard" },
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
            The buyer dashboard gives you a quick overview of your procurement
            activity:
          </Paragraph>
          <BulletList
            items={[
              "Active demand postings you\u2019ve created",
              "Recent matches with farmers",
              "Match status updates (accepted, pending, completed)",
              "Notification badge showing unread alerts",
            ]}
          />
        </>
      ),
    },
    /* ---------- 3 ---------- */
    {
      number: 3,
      title: "Creating Demand Postings",
      content: (
        <>
          <Paragraph>
            A demand posting tells GoviHub what spices you want to buy. This is
            how you signal your requirements to the farmer network.
          </Paragraph>

          <SubHeading>3.1 How to Create a Demand Posting</SubHeading>
          <StepTable
            steps={[
              { step: 1, action: "Go to Demands", details: 'Tap "Demands" from the navigation' },
              { step: 2, action: 'Tap "Create New"', details: "The create demand form will open" },
              { step: 3, action: "Select Crop Type", details: "Choose the spice you need: black pepper, turmeric, ginger, cloves, nutmeg, cardamom, cinnamon, or mixed spices" },
              { step: 4, action: "Enter Quantity Needed", details: "How many kilograms you want to purchase" },
              { step: 5, action: "Set Your Price Range", details: "Minimum and maximum price per kilogram (LKR) you are willing to pay" },
              { step: 6, action: "Set Quality Grade", details: "Select the minimum grade you accept (Grade A, B, or C)" },
              { step: 7, action: "Set Delivery Window", details: "When you need the supply \u2014 start date and end date" },
              { step: 8, action: "Add Requirements", details: "Any special requirements: organic certification, specific drying method, packaging, etc." },
              { step: 9, action: "Submit", details: "Your demand goes live and the matching engine starts searching for farmers" },
            ]}
          />

          <SubHeading>3.2 Managing Your Demands</SubHeading>
          <BulletList
            items={[
              <><strong>Edit</strong> &mdash; Update quantity, price range, or delivery window at any time</>,
              <><strong>Change Status</strong> &mdash; Mark as fulfilled, expired, or reactivate</>,
              <><strong>Delete</strong> &mdash; Remove a demand you no longer need</>,
            ]}
          />
          <TipBox>
            <strong>Demand Tips:</strong> Be specific about quality grade and
            delivery window &mdash; the matching engine uses these to find the best
            farmer matches. A wider price range gives you more match options.
          </TipBox>
        </>
      ),
    },
    /* ---------- 4 ---------- */
    {
      number: 4,
      title: "Smart Matching with Farmers",
      content: (
        <>
          <Paragraph>
            GoviHub&apos;s AI matching engine automatically pairs your demand
            postings with farmer harvest listings. It scores each potential match
            based on:
          </Paragraph>
          <BulletList
            items={[
              <><strong>Distance between you and the farmer</strong> (35% weight) &mdash; closer farmers reduce transport costs</>,
              <><strong>Quantity fit</strong> (25%) &mdash; does the farmer&apos;s harvest size match your needs?</>,
              <><strong>Date overlap</strong> (25%) &mdash; is the harvest ready within your delivery window?</>,
              <><strong>Listing freshness</strong> (15%) &mdash; newer, more current listings get a boost</>,
            ]}
          />

          <SubHeading>4.1 Working with Matches</SubHeading>
          <Paragraph>
            When a match is found, you&apos;ll see it on your Matches page and
            receive a notification. For each match, you can:
          </Paragraph>
          <QuickRefTable
            headers={{ want: "Action", goto: "What It Does" }}
            rows={[
              { want: "Review", goto: "See the farmer\u2019s name, location, available quantity, asking price, quality grade, and listing photo" },
              { want: "Accept", goto: "You agree to purchase from this farmer. The farmer is notified" },
              { want: "Reject", goto: "Not interested. The match is removed" },
              { want: "Dismiss", goto: "Ignore for now without rejecting" },
              { want: "Complete/Fulfill", goto: "After receiving the goods, mark the match as completed" },
            ]}
          />
          <TipBox>
            <strong>Build Your Network:</strong> Over time, your match history
            helps you identify the most reliable farmers. Completed matches build
            trust and improve future matching.
          </TipBox>
        </>
      ),
    },
    /* ---------- 5 ---------- */
    {
      number: 5,
      title: "Browsing Harvest Listings",
      content: (
        <>
          <Paragraph>
            Besides waiting for AI matches, you can proactively browse available
            harvests from all farmers on the platform.
          </Paragraph>
          <StepTable
            steps={[
              { step: 1, action: "Go to Marketplace", details: 'Tap "Marketplace" from the navigation' },
              { step: 2, action: "Browse or Filter", details: "Filter by crop type, district, quality grade, or price range" },
              { step: 3, action: "View Listing Details", details: "See quantity, price, photos, farmer profile, and location" },
              { step: 4, action: "Contact or Match", details: "Express interest to initiate a match with the farmer" },
            ]}
          />
        </>
      ),
    },
    /* ---------- 6 ---------- */
    {
      number: 6,
      title: "Supply Marketplace",
      content: (
        <>
          <Paragraph>
            You can also browse farming input listings from verified suppliers
            &mdash; seeds, fertilizers, tools, and equipment. This is useful if
            you also process or need to source raw materials for value-added
            production.
          </Paragraph>
        </>
      ),
    },
    /* ---------- 7 ---------- */
    {
      number: 7,
      title: "Notifications",
      content: (
        <>
          <Paragraph>GoviHub sends you notifications for:</Paragraph>
          <BulletList
            items={[
              "New farmer matches for your demand postings",
              "Match status updates (farmer accepted, completed, etc.)",
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
    /* ---------- 8 ---------- */
    {
      number: 8,
      title: "Settings & Profile",
      content: (
        <>
          <SubHeading>8.1 Profile Settings</SubHeading>
          <Paragraph>
            Update your business information: company name, phone number,
            district, and buying preferences.
          </Paragraph>
          <SubHeading>8.2 Notification Preferences</SubHeading>
          <Paragraph>
            Control which notifications you receive. Enable or disable alerts for
            matches, price updates, and announcements.
          </Paragraph>
          <SubHeading>8.3 Change Password</SubHeading>
          <Paragraph>
            Go to Settings &gt; Change Password. You&apos;ll need your current
            password to set a new one.
          </Paragraph>
        </>
      ),
    },
    /* ---------- 9 ---------- */
    {
      number: 9,
      title: "Giving Feedback",
      content: (
        <>
          <Paragraph>
            Help us improve GoviHub! Go to the More menu and tap
            &quot;Feedback&quot; to share your thoughts, report issues, or suggest
            features.
          </Paragraph>
        </>
      ),
    },
    /* ---------- 10 ---------- */
    {
      number: 10,
      title: "Quick Reference",
      content: (
        <QuickRefTable
          headers={{ want: "I want to...", goto: "Go to..." }}
          rows={[
            { want: "Post what I need to buy", goto: "Demands > Create New" },
            { want: "See farmer matches", goto: "Matches (navigation)" },
            { want: "Browse available harvests", goto: "Marketplace" },
            { want: "See my notifications", goto: "Notification bell on dashboard" },
            { want: "Update my profile", goto: "Settings" },
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
      "Submit feedback through the app (More > Feedback)",
      "Contact your local GoviHub coordinator",
      "Visit our YouTube channel: @GoviHubSriLanka",
    ],
  },
};

/* ------------------------------------------------------------------ */
/*  Content data — Sinhala                                             */
/* ------------------------------------------------------------------ */

const si = {
  meta: {
    title: "GoviHub Spices \u2014 \u0D9C\u0DD0\u0DB1\u0DD4\u0DB8\u0DCA\u0D9A\u0DBB\u0DD4\u0DC0\u0DB1\u0DCA \u0DC3\u0DAF\u0DC4\u0DCF \u0DB8\u0DCF\u0DBB\u0DCA\u0D9C\u0DDD\u0DB4\u0DAF\u0DDA\u0DC1\u0DBA",
    subtitle: "\u0DC1\u0DCA\u200D\u0DBB\u0DD3 \u0DBD\u0D82\u0D9A\u0DCF\u0DC0\u0DDA AI \u0D9A\u0DD4\u0DC5\u0DD4\u0DB6\u0DA9\u0DD4 \u0DC0\u0DD9\u0DC5\u0DAF\u0DB4\u0DDC\u0DC5",
    version: "\u0DC3\u0D82\u0DC3\u0DCA\u0D9A\u0DBB\u0DAB\u0DBA 1.0 \u2014 2026 \u0D85\u0DB4\u0DCA\u200D\u0DBB\u0DDA\u0DBD\u0DCA",
    backLabel: "\u2190 \u0D89\u0D9C\u0DD9\u0DB1\u0DD3\u0DB8 \u0DC0\u0DBD\u0DA7",
    langToggleLabel: "EN",
    printLabel: "\u0DB8\u0DD4\u0DAF\u0DCA\u200D\u0DBB\u0DAB\u0DBA",
    ctaButton: "GoviHub \u0DC3\u0DB8\u0D9F \u0D86\u0DBB\u0DB8\u0DCA\u0DB7 \u0D9A\u0DBB\u0DB1\u0DCA\u0DB1",
    youtubeText: "\u0D85\u0DB4\u0D9C\u0DDA YouTube \u0DB1\u0DCF\u0DBD\u0DD2\u0D9A\u0DCF\u0DC0\u0DDA \u0DC0\u0DD3\u0DA9\u0DD2\u0DBA\u0DDD \u0DB1\u0DBB\u0DB6\u0DB1\u0DCA\u0DB1",
    youtubeChannel: "@GoviHubSriLanka",
    footer:
      "GoviHub Spices \u2014 AI \u0DAD\u0DCF\u0D9A\u0DCA\u0DC2\u0DAB\u0DBA \u0DC4\u0DBB\u0DC4\u0DCF \u0DC1\u0DCA\u200D\u0DBB\u0DD3 \u0DBD\u0DCF\u0D82\u0D9A\u0DD2\u0D9A \u0D9A\u0DD4\u0DC5\u0DD4\u0DB6\u0DA9\u0DD4 \u0D9C\u0DD0\u0DB1\u0DD4\u0DB8\u0DCA\u0D9A\u0DBB\u0DD4\u0DC0\u0DB1\u0DCA \u0D9C\u0DDC\u0DC0\u0DD3\u0DB1\u0DCA \u0DC3\u0DB8\u0D9F \u0D9A\u0DD9\u0DBD\u0DD2\u0DB1\u0DCA\u0DB8 \u0DC3\u0DB8\u0DCA\u0DB6\u0DB1\u0DCA\u0DB0 \u0D9A\u0DBB\u0DBA\u0DD2",
    footerOrg: "AiGNITE Consulting \u0DC0\u0DD2\u0DC3\u0DD2\u0DB1\u0DCA \u0DC3\u0D9A\u0DC3\u0DCA \u0D9A\u0DC5\u0DDA \u2014 2026 \u0D85\u0DB4\u0DCA\u200D\u0DBB\u0DDA\u0DBD\u0DCA",
  },
  sections: [
    /* ---------- 1 ---------- */
    {
      number: 1,
      title: "\u0DB4\u0DA7\u0DB1\u0DCA \u0D9C\u0DB1\u0DD2\u0DB8\u0DD4",
      content: (
        <>
          <Paragraph>
            GoviHub Spices \u0DC4\u0DBB\u0DC4\u0DCF \u0D94\u0DB6\u0DA7 \u0DBD\u0D82\u0D9A\u0DCF\u0DC0\u0DDA \u0D9A\u0DD4\u0DC5\u0DD4\u0DB6\u0DA9\u0DD4 \u0D9C\u0DDC\u0DC0\u0DD3\u0DB1\u0DCA \u0DC3\u0DB8\u0D9F \u0D9A\u0DD9\u0DBD\u0DD2\u0DB1\u0DCA\u0DB8 \u0DC3\u0DB8\u0DCA\u0DB6\u0DB1\u0DCA\u0DB0 \u0DC0\u0DD9\u0DB1\u0DCA\u0DB1 \u0DB4\u0DD4\u0DC5\u0DD4\u0DC0\u0DB1\u0DCA
            &ndash; \u0D85\u0DAD\u0DBB\u0DB8\u0DD0\u0DAF\u0DD2\u0DBA\u0DDD \u0DB1\u0DD1, \u0D91\u0DA2\u0DB1\u0DCA\u0DA7\u0DCA\u0DBD\u0DCF \u0DB1\u0DD1, \u0D85\u0DB1\u0DC0\u0DC1\u0DCA\u200D\u0DBB \u0D9C\u0DB8\u0DB1\u0DCA \u0DB6\u0DD2\u0DB8\u0DB1\u0DCA \u0DB1\u0DD1. \u0D94\u0DB6\u0DA7 \u0D85\u0DC0\u0DC1\u0DCA\u200D\u0DBA \u0DAF\u0DDA \u0DB4\u0DBD \u0D9A\u0DBB\u0DB1\u0DCA\u0DB1, GoviHub&apos;s AI matching engine \u0D91\u0D9A \u0D94\u0DB6\u0DA7 \u0D9C\u0DD0\u0DBD\u0DB4\u0DD9\u0DB1 \u0D9C\u0DDC\u0DC0\u0DD3\u0DB1\u0DCA\u0DC0 \u0DC4\u0DDC\u0DBA\u0DCF \u0DAF\u0DDA\u0DC0\u0DD2.
          </Paragraph>

          <SubHeading>1.1 \u0D94\u0DB6\u0DA7 \u0D85\u0DC0\u0DC1\u0DCA\u200D\u0DBA \u0DAF\u0DDA\u0DC0\u0DBD\u0DCA</SubHeading>
          <BulletList
            items={[
              "\u0D85\u0DB1\u0DCA\u0DAD\u0DBB\u0DCA\u0DA2\u0DCF\u0DBD \u0DB4\u0DC4\u0DC3\u0DD4\u0D9A\u0DB8\u0DCA \u0DC3\u0DC4\u0DD2\u0DAD \u0DC3\u0DCA\u0DB8\u0DCF\u0DBB\u0DCA\u0DA7\u0DCA\u0DC6\u0DDD\u0DB1\u0DCA \u0D91\u0D9A\u0D9A\u0DCA \u0DC4\u0DDD \u0DB4\u0DBB\u0DD2\u0D9C\u0DAB\u0D9A\u0DBA\u0D9A\u0DCA",
              "Chrome, Safari, \u0DC4\u0DDD \u0DC0\u0DD9\u0DB1\u0DAD\u0DCA \u0D95\u0DB1\u0DD1\u0DB8 \u0DB1\u0DC0\u0DD3\u0DB1 \u0DC0\u0DD9\u0DB6\u0DCA \u0DB6\u0DCA\u200D\u0DBB\u0DC0\u0DD4\u0DC3\u0DBB\u0DBA\u0D9A\u0DCA",
            ]}
          />
          <TipBox>
            <strong>\u0D87\u0DB4\u0DCA \u0D91\u0D9A\u0D9A\u0DCA \u0DBD\u0DD9\u0DC3 \u0DC3\u0DCA\u0DAD\u0DCF\u0DB4\u0DB1\u0DBA \u0D9A\u0DBB\u0DB1\u0DCA\u0DB1:</strong> Chrome \u0DC0\u0DBD\u0DD2\u0DB1\u0DCA spices.govihublk.com \u0DC0\u0DD9\u0DB6\u0DCA \u0D85\u0DA9\u0DC0\u0DD2\u0DBA\u0DA7 \u0D9C\u0DD2\u0DC4\u0DD2\u0DB1\u0DCA, &quot;Add to Home Screen&quot; \u0D9A\u0DD2\u0DBA\u0DB1 \u0D91\u0D9A \u0DA7\u0DD0\u0DB4\u0DCA \u0D9A\u0DBB\u0DBD\u0DCF GoviHub \u0D87\u0DB4\u0DCA \u0D91\u0D9A\u0D9A\u0DCA \u0DC0\u0DD2\u0DAF\u0DD2\u0DC4\u0DA7 \u0D94\u0DB6\u0DDA \u0DC6\u0DDD\u0DB1\u0DCA \u0D91\u0D9A\u0DA7 \u0DC3\u0DCA\u0DAD\u0DCF\u0DB4\u0DB1\u0DBA \u0D9A\u0DBB\u0D9C\u0DB1\u0DCA\u0DB1.
          </TipBox>

          <SubHeading>1.2 \u0D94\u0DB6\u0DDA \u0D9C\u0DD2\u0DAB\u0DD4\u0DB8 \u0DC3\u0DCF\u0DAF\u0DCF \u0D9C\u0DD0\u0DB1\u0DD3\u0DB8</SubHeading>
          <StepTable
            steps={[
              { step: 1, action: "GoviHub \u0DC0\u0DD2\u0DC0\u0DD8\u0DAD \u0D9A\u0DBB\u0DB1\u0DCA\u0DB1", details: "\u0D94\u0DB6\u0DDA \u0DB6\u0DCA\u200D\u0DBB\u0DC0\u0DD4\u0DC3\u0DBB\u0DBA\u0DD9\u0DB1\u0DCA spices.govihublk.com \u0DC0\u0DD9\u0DAD \u0DBA\u0DB1\u0DCA\u0DB1" },
              { step: 2, action: "Register \u0DA7\u0DD0\u0DB4\u0DCA \u0D9A\u0DBB\u0DB1\u0DCA\u0DB1", details: "\u0DB8\u0DD4\u0DBD\u0DCA \u0DB4\u0DD2\u0DA7\u0DD4\u0DC0\u0DDA \u0D87\u0DAD\u0DD2 \"Register\" \u0DB6\u0DDC\u0DAD\u0DCA\u0DAD\u0DB8 \u0DA7\u0DD0\u0DB4\u0DCA \u0D9A\u0DBB\u0DB1\u0DCA\u0DB1" },
              { step: 3, action: "\u0D94\u0DB6\u0DDA \u0DC0\u0DD2\u0DC3\u0DCA\u0DAD\u0DBB \u0D87\u0DAD\u0DD4\u0DC5\u0DAD\u0DCA \u0D9A\u0DBB\u0DB1\u0DCA\u0DB1", details: "Username, password, \u0DC3\u0DB8\u0DCA\u0DB4\u0DD6\u0DBB\u0DCA\u0DAB \u0DB1\u0DB8, \u0DAF\u0DD4\u0DBB\u0D9A\u0DAD\u0DB1 \u0D85\u0D82\u0D9A\u0DBA \u0DC3\u0DC4 \u0DAF\u0DD2\u0DC3\u0DCA\u0DAD\u0DCA\u200D\u0DBB\u0DD2\u0D9A\u0DCA\u0D9A\u0DBA" },
              { step: 4, action: "\u0D94\u0DB6\u0DDA \u0DB7\u0DD6\u0DB8\u0DD2\u0D9A\u0DCF\u0DC0 \u0DAD\u0DDD\u0DBB\u0DB1\u0DCA\u0DB1", details: "\u0D94\u0DB6\u0DDA \u0DB7\u0DD6\u0DB8\u0DD2\u0D9A\u0DCF\u0DC0 \u0DBD\u0DD9\u0DC3 \"Buyer\" \u0DAD\u0DDD\u0DBB\u0DB1\u0DCA\u0DB1" },
              { step: 5, action: "\u0D94\u0DB6\u0DDA \u0DB4\u0DD0\u0DAD\u0DD2\u0D9A\u0DA9 \u0DC3\u0DB8\u0DCA\u0DB4\u0DD6\u0DBB\u0DCA\u0DAB \u0D9A\u0DBB\u0DB1\u0DCA\u0DB1", details: "\u0D94\u0DB6\u0DDA \u0DC0\u0DCA\u200D\u0DBA\u0DCF\u0DB4\u0DCF\u0DBB\u0DBA\u0DDA \u0DB1\u0DB8, \u0DB8\u0DD2\u0DBD\u0DAF\u0DD3 \u0D9C\u0DD0\u0DB1\u0DD3\u0DB8\u0DDA \u0DB0\u0DCF\u0DBB\u0DD2\u0DAD\u0DCF\u0DC0 \u0DC3\u0DC4 \u0D9A\u0DD0\u0DB8\u0DAD\u0DD2 \u0DB6\u0DDD\u0D9C \u0D87\u0DAD\u0DD4\u0DC5\u0DAD\u0DCA \u0D9A\u0DBB\u0DB1\u0DCA\u0DB1" },
              { step: 6, action: "\u0D94\u0DB6\u0DDA \u0DC3\u0DCA\u0DAD\u0DCF\u0DB1\u0DBA \u0DC3\u0D9A\u0DC3\u0DB1\u0DCA\u0DB1", details: "GPS \u0DB4\u0DCA\u200D\u0DBB\u0DC0\u0DDA\u0DC1\u0DBA\u0DA7 \u0D89\u0DA9 \u0DAF\u0DD9\u0DB1\u0DCA\u0DB1 \u0DC4\u0DDD \u0D94\u0DB6\u0DDA \u0DAF\u0DD2\u0DC3\u0DCA\u0DAD\u0DCA\u200D\u0DBB\u0DD2\u0D9A\u0DCA\u0D9A\u0DBA \u0D87\u0DAD\u0DD4\u0DC5\u0DAD\u0DCA \u0D9A\u0DBB\u0DB1\u0DCA\u0DB1. \u0DB8\u0DD9\u0DBA \u0D94\u0DB6\u0DC0 \u0D85\u0DC3\u0DBD \u0DC3\u0DD2\u0DA7\u0DD2\u0DB1 \u0D9C\u0DDC\u0DC0\u0DD3\u0DB1\u0DCA \u0DC3\u0DB8\u0D9F \u0DC3\u0DB8\u0DCA\u0DB6\u0DB1\u0DCA\u0DB0 \u0D9A\u0DD2\u0DBB\u0DD3\u0DB8\u0DA7 \u0DB7\u0DCF\u0DC0\u0DD2\u0DAD\u0DCF \u0D9A\u0DBB\u0DBA\u0DD2" },
              { step: 7, action: "\u0D85\u0DC0\u0DC3\u0DB1\u0DCA!", details: "\u0D94\u0DB6 \u0D94\u0DB6\u0DDA Buyer Dashboard \u0DC0\u0DD9\u0DAD \u0DBA\u0DDC\u0DB8\u0DD4 \u0D9A\u0DBB\u0DB1\u0DD4 \u0D87\u0DAD" },
            ]}
          />
          <WarningBox>
            <strong>\u0D94\u0DB6\u0DDA \u0DB4\u0DD2\u0DC0\u0DD2\u0DC3\u0DD4\u0DB8\u0DCA \u0DAD\u0DDC\u0DBB\u0DAD\u0DD4\u0DBB\u0DD4 \u0DB8\u0DAD\u0D9A \u0DAD\u0DB6\u0DCF \u0D9C\u0DB1\u0DCA\u0DB1:</strong> \u0D94\u0DB6\u0DDA username \u0DC3\u0DC4 password \u0DBD\u0DD2\u0DBA\u0DCF \u0DAD\u0DB6\u0DCF \u0D9C\u0DB1\u0DCA\u0DB1. \u0D91\u0DC0\u0DCF \u0D85\u0DB8\u0DAD\u0D9A \u0DC0\u0DD4\u0DAB\u0DDC\u0DAD\u0DCA, \u0D87\u0DA9\u0DCA\u0DB8\u0DD2\u0DB1\u0DCA \u0D9A\u0DD9\u0DB1\u0DD9\u0D9A\u0DD4\u0DA7 \u0D94\u0DB6\u0DDA \u0D9C\u0DD2\u0DAB\u0DD4\u0DB8 \u0DB1\u0DD0\u0DC0\u0DAD \u0DC3\u0D9A\u0DC3\u0DCA \u0D9A\u0DBB\u0DB1\u0DCA\u0DB1 \u0DC3\u0DD2\u0DAF\u0DCA\u0DB0 \u0DC0\u0DDA\u0DC0\u0DD2.
          </WarningBox>
        </>
      ),
    },
    /* ---------- 2 ---------- */
    {
      number: 2,
      title: "\u0D94\u0DB6\u0DDA Dashboard \u0D91\u0D9A",
      content: (
        <>
          <Paragraph>
            \u0D9C\u0DD0\u0DB1\u0DD4\u0DB8\u0DCA\u0D9A\u0DBB\u0DD4\u0DC0\u0DB1\u0DCA\u0D9C\u0DDA Dashboard \u0D91\u0D9A\u0DD9\u0DB1\u0DCA \u0D94\u0DB6\u0DDA \u0DB8\u0DD2\u0DBD\u0DAF\u0DD3 \u0D9C\u0DD0\u0DB1\u0DD3\u0DB8\u0DDA \u0D9A\u0DA7\u0DBA\u0DD4\u0DAD\u0DD4 \u0D9C\u0DD0\u0DB1 \u0D89\u0D9A\u0DCA\u0DB8\u0DB1\u0DCA \u0DAF\u0DC5 \u0DC0\u0DD2\u0DC1\u0DCA\u0DBD\u0DDA\u0DC2\u0DAB\u0DBA\u0D9A\u0DCA \u0DB6\u0DBD\u0DCF\u0D9C\u0DB1\u0DCA\u0DB1 \u0DB4\u0DD4\u0DC5\u0DD4\u0DC0\u0DB1\u0DCA:
          </Paragraph>
          <BulletList
            items={[
              "\u0D94\u0DB6 \u0DB4\u0DC5 \u0D9A\u0DBB\u0DB4\u0DD4 \u0D9A\u0DCA\u200D\u0DBB\u0DD2\u0DBA\u0DCF\u0D9A\u0DCF\u0DBB\u0DD3 \u0D89\u0DBD\u0DCA\u0DBD\u0DD4\u0DB8\u0DCA \u0DAF\u0DD0\u0DB1\u0DCA\u0DC0\u0DD3\u0DB8\u0DCA",
              "\u0D9C\u0DDC\u0DC0\u0DD3\u0DB1\u0DCA \u0DC3\u0DB8\u0D9F \u0D85\u0DBD\u0DD4\u0DAD\u0DD2\u0DB1\u0DCA \u0D9C\u0DD0\u0DBD\u0DB4\u0DD4\u0DB1\u0DD4 \u0D9C\u0DD0\u0DBD\u0DB4\u0DD3\u0DB8\u0DCA",
              "\u0D9C\u0DD0\u0DBD\u0DB4\u0DD3\u0DB8\u0DCA \u0DC0\u0DBD \u0DAD\u0DAD\u0DCA\u0DAD\u0DCA\u0DC0 \u0DBA\u0DCF\u0DC0\u0DAD\u0DCA\u0D9A\u0DCF\u0DBD\u0DD3\u0DB1 \u0D9A\u0DD2\u0DBB\u0DD3\u0DB8\u0DCA (\u0DB4\u0DD2\u0DC5\u0DD2\u0D9C\u0DAD\u0DCA, \u0DB6\u0DBD\u0DCF\u0DB4\u0DDC\u0DBB\u0DDC\u0DAD\u0DCA\u0DAD\u0DD4 \u0DC0\u0DB1, \u0DC3\u0DB8\u0DCA\u0DB4\u0DD6\u0DBB\u0DCA\u0DAB \u0DC0\u0DD6)",
              "\u0DB1\u0DDC\u0D9A\u0DD2\u0DBA\u0DC0\u0DD6 \u0DAF\u0DD0\u0DB1\u0DD4\u0DB8\u0DCA\u0DAF\u0DD3\u0DB8\u0DCA \u0DB4\u0DD9\u0DB1\u0DCA\u0DC0\u0DB1 \u0DAF\u0DD0\u0DB1\u0DD4\u0DB8\u0DCA\u0DAF\u0DD3\u0DB8\u0DCA badge \u0D91\u0D9A",
            ]}
          />
        </>
      ),
    },
    /* ---------- 3 ---------- */
    {
      number: 3,
      title: "Demand Postings \u0DC4\u0DAF\u0DB1 \u0DC4\u0DD0\u0DA7\u0DD2",
      content: (
        <>
          <Paragraph>
            demand posting \u0D91\u0D9A\u0D9A\u0DCA GoviHub \u0D91\u0D9A\u0DA7 \u0D9A\u0DD2\u0DBA\u0DB1\u0DC0\u0DCF \u0D94\u0DBA\u0DCF\u0DA7 \u0DB8\u0DDC\u0DB1 \u0DC0\u0D9C\u0DDA \u0D9A\u0DD4\u0DC5\u0DD4\u0DB6\u0DA9\u0DD4\u0DAF \u0D9C\u0DB1\u0DCA\u0DB1 \u0D95\u0DB1\u0DDA \u0D9A\u0DD2\u0DBA\u0DBD\u0DCF. \u0DB8\u0DDA\u0D9A\u0DD9\u0DB1\u0DCA \u0DAD\u0DB8\u0DBA\u0DD2 \u0D94\u0DBA\u0DCF\u0D9C\u0DDA \u0D85\u0DC0\u0DC1\u0DCA\u200D\u0DBA\u0DAD\u0DCF \u0D9C\u0DDC\u0DC0\u0DD2 \u0DA2\u0DCF\u0DBD\u0DBA\u0DA7 \u0DAF\u0DD0\u0DB1\u0DD4\u0DB8\u0DCA \u0DAF\u0DD9\u0DB1\u0DCA\u0DB1\u0DDA.
          </Paragraph>

          <SubHeading>3.1 Demand Posting \u0D91\u0D9A\u0D9A\u0DCA \u0DC4\u0DAF\u0DB1 \u0DC4\u0DD0\u0DA7\u0DD2</SubHeading>
          <StepTable
            steps={[
              { step: 1, action: "Demands \u0DC0\u0DD9\u0DAD \u0DBA\u0DB1\u0DCA\u0DB1", details: "navigation \u0D91\u0D9A\u0DD9\u0DB1\u0DCA \"Demands\" \u0DA7\u0DA7\u0DCA\u0DA7\u0DD4 \u0D9A\u0DBB\u0DB1\u0DCA\u0DB1" },
              { step: 2, action: "\"Create New\" \u0DA7\u0DA7\u0DCA\u0DA7\u0DD4 \u0D9A\u0DBB\u0DB1\u0DCA\u0DB1", details: "demand \u0D91\u0D9A\u0D9A\u0DCA \u0DC4\u0DAF\u0DB1 form \u0D91\u0D9A open \u0DC0\u0DD9\u0DBA\u0DD2" },
              { step: 3, action: "\u0DB6\u0DDD\u0D9C \u0DC0\u0DBB\u0DCA\u0D9C\u0DBA \u0DAD\u0DDD\u0DBB\u0DB1\u0DCA\u0DB1", details: "\u0D94\u0DBA\u0DCF\u0DA7 \u0D85\u0DC0\u0DC1\u0DCA\u200D\u0DBA \u0D9A\u0DD4\u0DC5\u0DD4\u0DB6\u0DA9\u0DD4\u0DC0 \u0DAD\u0DDD\u0DBB\u0DB1\u0DCA\u0DB1: \u0D9C\u0DB8\u0DCA\u0DB8\u0DD2\u0DBB\u0DD2\u0DC3\u0DCA, \u0D9A\u0DC4, \u0D89\u0D9F\u0DD4\u0DBB\u0DD4, \u0D9A\u0DBB\u0DCF\u0DB6\u0DD4\u0DB1\u0DD0\u0DA7\u0DD2, \u0DC3\u0DCF\u0DAF\u0DD2\u0D9A\u0DCA\u0D9A\u0DCF, \u0D91\u0DB1\u0DC3\u0DCF\u0DBD\u0DCA, \u0D9A\u0DD4\u0DBB\u0DD4\u0DAF\u0DD4, \u0DB1\u0DD0\u0DAD\u0DCA\u0DB1\u0DB8\u0DCA \u0DB8\u0DD2\u0DC1\u0DCA\u200D\u0DBB \u0D9A\u0DD4\u0DC5\u0DD4\u0DB6\u0DA9\u0DD4" },
              { step: 4, action: "\u0D85\u0DC0\u0DC1\u0DCA\u200D\u0DBA \u0DB4\u0DCA\u200D\u0DBB\u0DB8\u0DCF\u0DAB\u0DBA \u0D87\u0DAD\u0DD4\u0DC5\u0DAD\u0DCA \u0D9A\u0DBB\u0DB1\u0DCA\u0DB1", details: "\u0D94\u0DBA\u0DCF\u0DA7 \u0D9C\u0DB1\u0DCA\u0DB1 \u0D95\u0DB1 \u0D9A\u0DD2\u0DBD\u0DDD\u0D9C\u0DCA\u200D\u0DBB\u0DD1\u0DB8\u0DCA \u0D9A\u0DD3\u0DBA\u0D9A\u0DCA\u0DAF \u0D9A\u0DD2\u0DBA\u0DBD\u0DCF" },
              { step: 5, action: "\u0D94\u0DBA\u0DCF\u0D9C\u0DDA \u0DB8\u0DD2\u0DBD \u0DB4\u0DBB\u0DCF\u0DC3\u0DBA \u0DC3\u0D9A\u0DC3\u0DB1\u0DCA\u0DB1", details: "\u0D9A\u0DD2\u0DBD\u0DDD\u0D9C\u0DCA\u200D\u0DBB\u0DD1\u0DB8\u0DCA \u0D91\u0D9A\u0D9A\u0DA7 \u0D94\u0DBA\u0DCF \u0D9C\u0DD9\u0DC0\u0DB1\u0DCA\u0DB1 \u0D9A\u0DD0\u0DB8\u0DAD\u0DD2 \u0D85\u0DC0\u0DB8 \u0DC3\u0DC4 \u0D8B\u0DB4\u0DBB\u0DD2\u0DB8 \u0DB8\u0DD2\u0DBD (LKR)" },
              { step: 6, action: "\u0DAD\u0DAD\u0DCA\u0DAD\u0DCA\u0DC0 \u0DC1\u0DCA\u200D\u0DBB\u0DDA\u0DAB\u0DD2\u0DBA \u0DC3\u0D9A\u0DC3\u0DB1\u0DCA\u0DB1", details: "\u0D94\u0DBA\u0DCF \u0DB6\u0DCF\u0DBB\u0D9C\u0DB1\u0DCA\u0DB1 \u0D85\u0DC0\u0DB8 Grade \u0D91\u0D9A \u0DAD\u0DDD\u0DBB\u0DB1\u0DCA\u0DB1 (Grade A, B, \u0DB1\u0DD0\u0DAD\u0DCA\u0DB1\u0DB8\u0DCA C)" },
              { step: 7, action: "\u0DB6\u0DD9\u0DAF\u0DCF\u0DC4\u0DD0\u0DBB\u0DD3\u0DB8\u0DDA \u0D9A\u0DCF\u0DBD \u0DC3\u0DD3\u0DB8\u0DCF\u0DC0 \u0DC3\u0D9A\u0DC3\u0DB1\u0DCA\u0DB1", details: "\u0D94\u0DBA\u0DCF\u0DA7 \u0DC3\u0DD0\u0DB4\u0DBA\u0DD4\u0DB8 \u0D85\u0DC0\u0DC1\u0DCA\u200D\u0DBA \u0DC0\u0DD9\u0DB1\u0DCA\u0DB1\u0DDA \u0D9A\u0DC0\u0DAF\u0DCA\u0DAF \u2014 \u0D86\u0DBB\u0DB8\u0DCA\u0DB7\u0D9A \u0DAF\u0DD2\u0DB1\u0DBA \u0DC3\u0DC4 \u0D85\u0DC0\u0DC3\u0DB1\u0DCA \u0DAF\u0DD2\u0DB1\u0DBA" },
              { step: 8, action: "\u0D85\u0DC0\u0DC1\u0DCA\u200D\u0DBA\u0DAD\u0DCF \u0D91\u0D9A\u0DAD\u0DD4 \u0D9A\u0DBB\u0DB1\u0DCA\u0DB1", details: "\u0D95\u0DB1\u0DD1\u0DB8 \u0DC0\u0DD2\u0DC1\u0DDA\u0DC2 \u0D85\u0DC0\u0DC1\u0DCA\u200D\u0DBA\u0DAD\u0DCF\u0DC0\u0D9A\u0DCA: \u0D9A\u0DCF\u0DB6\u0DB1\u0DD2\u0D9A \u0DC3\u0DC4\u0DAD\u0DD2\u0D9A\u0DBA, \u0DB1\u0DD2\u0DC1\u0DCA\u0DA0\u0DD2\u0DAD \u0DC0\u0DD2\u0DBA\u0DC5\u0DD3\u0DB8\u0DDA \u0D9A\u0DCA\u200D\u0DBB\u0DB8\u0DBA, \u0D87\u0DC3\u0DD4\u0DBB\u0DD4\u0DB8\u0DCA\u0D9A\u0DBB\u0DAB\u0DBA \u0DC0\u0D9C\u0DDA \u0DAF\u0DDA\u0DC0\u0DBD\u0DCA" },
              { step: 9, action: "\u0D89\u0DAF\u0DD2\u0DBB\u0DD2\u0DB4\u0DAD\u0DCA \u0D9A\u0DBB\u0DB1\u0DCA\u0DB1", details: "\u0D94\u0DBA\u0DCF\u0D9C\u0DDA demand \u0D91\u0D9A live \u0DC0\u0DD9\u0DB1\u0DC0\u0DCF, \u0D8A\u0DA7 \u0DB4\u0DC3\u0DCA\u0DC3\u0DDA matching engine \u0D91\u0D9A \u0D9C\u0DDC\u0DC0\u0DD3\u0DB1\u0DCA\u0DC0 \u0DC4\u0DDC\u0DBA\u0DB1\u0DCA\u0DB1 \u0DB4\u0DA7\u0DB1\u0DCA \u0D9C\u0DB1\u0DCA\u0DB1\u0DC0\u0DCF" },
            ]}
          />

          <SubHeading>3.2 \u0D94\u0DBA\u0DCF\u0D9C\u0DDA Demands \u0D9A\u0DC5\u0DB8\u0DB1\u0DCF\u0D9A\u0DBB\u0DAB\u0DBA \u0D9A\u0DBB\u0DB1 \u0DC4\u0DD0\u0DA7\u0DD2</SubHeading>
          <BulletList
            items={[
              <><strong>Edit \u0D9A\u0DBB\u0DB1\u0DCA\u0DB1</strong> &mdash; \u0D95\u0DB1\u0DD1\u0DB8 \u0DC0\u0DD9\u0DBD\u0DCF\u0DC0\u0D9A \u0DB4\u0DCA\u200D\u0DBB\u0DB8\u0DCF\u0DAB\u0DBA, \u0DB8\u0DD2\u0DBD \u0DB4\u0DBB\u0DCF\u0DC3\u0DBA, \u0DB1\u0DD0\u0DAD\u0DCA\u0DB1\u0DB8\u0DCA \u0DB6\u0DD9\u0DAF\u0DCF\u0DC4\u0DD0\u0DBB\u0DD3\u0DB8\u0DDA \u0D9A\u0DCF\u0DBD \u0DC3\u0DD3\u0DB8\u0DCF\u0DC0 update \u0D9A\u0DBB\u0DB1\u0DCA\u0DB1</>,
              <><strong>Status \u0D91\u0D9A \u0DC0\u0DD9\u0DB1\u0DC3\u0DCA \u0D9A\u0DBB\u0DB1\u0DCA\u0DB1</strong> &mdash; fulfilled, expired \u0D9A\u0DD2\u0DBA\u0DBD\u0DCF \u0DC3\u0DBD\u0D9A\u0DD4\u0DAB\u0DD4 \u0D9A\u0DBB\u0DB1\u0DCA\u0DB1, \u0DB1\u0DD0\u0DAD\u0DCA\u0DB1\u0DB8\u0DCA reactivate \u0D9A\u0DBB\u0DB1\u0DCA\u0DB1</>,
              <><strong>Delete \u0D9A\u0DBB\u0DB1\u0DCA\u0DB1</strong> &mdash; \u0D94\u0DBA\u0DCF\u0DA7 \u0DAD\u0DC0\u0DAF\u0DD4\u0DBB\u0DA7\u0DAD\u0DCA \u0D85\u0DC0\u0DC1\u0DCA\u200D\u0DBA \u0DB1\u0DD0\u0DAD\u0DD2 demand \u0D91\u0D9A\u0D9A\u0DCA \u0D85\u0DBA\u0DD2\u0DB1\u0DCA \u0D9A\u0DBB\u0DB1\u0DCA\u0DB1</>,
            ]}
          />
          <TipBox>
            <strong>Demand \u0D9C\u0DD0\u0DB1 \u0D8B\u0DB4\u0DAF\u0DD9\u0DC3\u0DCA:</strong> \u0DAD\u0DAD\u0DCA\u0DAD\u0DCA\u0DC0 Grade \u0D91\u0D9A \u0DC3\u0DC4 \u0DB6\u0DD9\u0DAF\u0DCF\u0DC4\u0DD0\u0DBB\u0DD3\u0DB8\u0DDA \u0D9A\u0DCF\u0DBD \u0DC3\u0DD3\u0DB8\u0DCF\u0DC0 \u0D9C\u0DD0\u0DB1 \u0DB1\u0DD2\u0DC1\u0DCA\u0DA0\u0DD2\u0DAD \u0DC0\u0DD9\u0DB1\u0DCA\u0DB1 &mdash; matching engine \u0D91\u0D9A \u0DB8\u0DDA\u0DC0\u0DCF \u0DB4\u0DCF\u0DC0\u0DD2\u0DA0\u0DCA\u0DA0\u0DD2 \u0D9A\u0DBB\u0DBD\u0DCF \u0DAD\u0DB8\u0DBA\u0DD2 \u0DC4\u0DDC\u0DB3\u0DB8 \u0D9C\u0DDC\u0DC0\u0DD2 \u0D9C\u0DD0\u0DBD\u0DB4\u0DD3\u0DB8\u0DCA \u0DC4\u0DDC\u0DBA\u0DCF\u0D9C\u0DB1\u0DCA\u0DB1\u0DDA. \u0DB4\u0DD4\u0DC5\u0DD4\u0DBD\u0DCA \u0DB8\u0DD2\u0DBD \u0DB4\u0DBB\u0DCF\u0DC3\u0DBA\u0D9A\u0DCA \u0D94\u0DBA\u0DCF\u0DA7 \u0DC0\u0DD0\u0DA9\u0DD2 \u0D9C\u0DD0\u0DBD\u0DB4\u0DD3\u0DB8\u0DCA \u0DC0\u0DD2\u0D9A\u0DBD\u0DCA\u0DB4 \u0DBD\u0DB6\u0DCF \u0DAF\u0DD9\u0DB1\u0DC0\u0DCF.
          </TipBox>
        </>
      ),
    },
    /* ---------- 4 ---------- */
    {
      number: 4,
      title: "\u0D9C\u0DDC\u0DC0\u0DD3\u0DB1\u0DCA \u0DC3\u0DB8\u0D9F \u0DC3\u0DCA\u0DB8\u0DCF\u0DBB\u0DCA\u0DA7\u0DCA \u0D9C\u0DD0\u0DBD\u0DB4\u0DD3\u0DB8\u0DCA",
      content: (
        <>
          <Paragraph>
            GoviHub \u0D91\u0D9A\u0DDA AI matching engine \u0D91\u0D9A \u0D94\u0DBA\u0DCF\u0D9C\u0DDA \u0D89\u0DBD\u0DCA\u0DBD\u0DD4\u0DB8\u0DCA \u0DAF\u0DD0\u0DB1\u0DCA\u0DC0\u0DD3\u0DB8\u0DCA \u0D9C\u0DDC\u0DC0\u0DD3\u0DB1\u0DCA\u0D9C\u0DDA \u0D85\u0DC3\u0DCA\u0DC0\u0DB1\u0DD4 \u0DAF\u0DD0\u0DB1\u0DCA\u0DC0\u0DD3\u0DB8\u0DCA \u0D91\u0D9A\u0DCA\u0D9A \u0DC3\u0DCA\u0DC0\u0DBA\u0D82\u0D9A\u0DCA\u200D\u0DBB\u0DD3\u0DBA\u0DC0 \u0D9C\u0DBD\u0DB4\u0DB1\u0DC0\u0DCF. \u0D91\u0D9A \u0DC4\u0DD0\u0DB8 \u0D9C\u0DD0\u0DBD\u0DB4\u0DD3\u0DB8\u0D9A\u0DCA\u0DB8 \u0DB8\u0DDA \u0DAF\u0DDA\u0DC0\u0DBD\u0DCA \u0DB8\u0DAD \u0DB4\u0DAF\u0DB1\u0DB8\u0DCA\u0DC0 \u0DBD\u0D9A\u0DD4\u0DAB\u0DD4 \u0D9A\u0DBB\u0DB1\u0DC0\u0DCF:
          </Paragraph>
          <BulletList
            items={[
              <><strong>\u0DAF\u0DD4\u0DBB</strong> (\u0D94\u0DBA\u0DCF\u0DBA\u0DD2 \u0D9C\u0DDC\u0DC0\u0DD2\u0DBA\u0DCF\u0DBA\u0DD2 \u0D85\u0DAD\u0DBB) (35% \u0DB6\u0DBB) &mdash; \u0DC5\u0D9F \u0D89\u0DB1\u0DCA\u0DB1 \u0D9C\u0DDC\u0DC0\u0DD3\u0DB1\u0DCA\u0D9C\u0DD9\u0DB1\u0DCA \u0DB4\u0DCA\u200D\u0DBB\u0DC0\u0DCF\u0DC4\u0DB1 \u0DC0\u0DD2\u0DBA\u0DAF\u0DB8\u0DCA \u0D85\u0DA9\u0DD4 \u0DC0\u0DD9\u0DB1\u0DC0\u0DCF</>,
              <><strong>\u0DB4\u0DCA\u200D\u0DBB\u0DB8\u0DCF\u0DAB\u0DBA \u0D9C\u0DD0\u0DBD\u0DB4\u0DD3\u0DB8</strong> (25%) &mdash; \u0D9C\u0DDC\u0DC0\u0DD2\u0DBA\u0DCF\u0D9C\u0DDA \u0D85\u0DC3\u0DCA\u0DC0\u0DD0\u0DB1\u0DCA\u0DB1\u0DDA \u0DB4\u0DCA\u200D\u0DBB\u0DB8\u0DCF\u0DAB\u0DBA \u0D94\u0DBA\u0DCF\u0D9C\u0DDA \u0D85\u0DC0\u0DC1\u0DCA\u200D\u0DBA\u0DAD\u0DCF\u0DC0\u0DBD\u0DA7 \u0D9C\u0DD0\u0DBD\u0DB4\u0DD9\u0DB1\u0DC0\u0DAF?</>,
              <><strong>\u0DAF\u0DD2\u0DB1\u0DBA \u0D9C\u0DD0\u0DBD\u0DB4\u0DD3\u0DB8</strong> (25%) &mdash; \u0D85\u0DC3\u0DCA\u0DC0\u0DD0\u0DB1\u0DCA\u0DB1 \u0D94\u0DBA\u0DCF\u0D9C\u0DDA \u0DB7\u0DCF\u0DBB\u0DAF\u0DD3\u0DB8\u0DDA \u0D9A\u0DCF\u0DBD \u0DC3\u0DD3\u0DB8\u0DCF\u0DC0 \u0D87\u0DAD\u0DD4\u0DC5\u0DAD \u0DC3\u0DD6\u0DAF\u0DCF\u0DB1\u0DB8\u0DCA\u0DAF?</>,
              <><strong>\u0DAF\u0DD0\u0DB1\u0DCA\u0DC0\u0DD3\u0DB8\u0DDA \u0D85\u0DBD\u0DD4\u0DAD\u0DCA \u0DB6\u0DC0</strong> (15%) &mdash; \u0D85\u0DBD\u0DD4\u0DAD\u0DCA\u0DB8, \u0DC0\u0DA9\u0DCF\u0DAD\u0DCA \u0DBA\u0DCF\u0DC0\u0DAD\u0DCA\u0D9A\u0DCF\u0DBD\u0DD3\u0DB1 \u0DAF\u0DD0\u0DB1\u0DCA\u0DC0\u0DD3\u0DB8\u0DCA\u0DC0\u0DBD\u0DA7 \u0DC0\u0DD0\u0DA9\u0DD2 \u0D85\u0DC0\u0DB0\u0DCF\u0DB1\u0DBA\u0D9A\u0DCA \u0DBD\u0DD0\u0DB6\u0DD9\u0DB1\u0DC0\u0DCF</>,
            ]}
          />

          <SubHeading>4.1 \u0D9C\u0DD0\u0DBD\u0DB4\u0DD3\u0DB8\u0DCA \u0DC3\u0DB8\u0D9F \u0DC0\u0DD0\u0DA9 \u0D9A\u0DD2\u0DBB\u0DD3\u0DB8</SubHeading>
          <Paragraph>
            \u0D9C\u0DD0\u0DBD\u0DB4\u0DD3\u0DB8\u0D9A\u0DCA \u0DC4\u0DB8\u0DCA\u0DB6\u0DD4\u0DAB\u0DCF\u0DB8, \u0D94\u0DBA\u0DCF\u0DA7 \u0D91\u0D9A Matches page \u0D91\u0D9A\u0DDA\u0DAF\u0DD3 \u0DB6\u0DBD\u0DCF\u0D9C\u0DB1\u0DCA\u0DB1 \u0DB4\u0DD4\u0DC5\u0DD4\u0DC0\u0DB1\u0DCA \u0DC0\u0D9C\u0DDA\u0DB8 \u0DAF\u0DD0\u0DB1\u0DD4\u0DB8\u0DCA\u0DAF\u0DD3\u0DB8\u0D9A\u0DD4\u0DAD\u0DCA \u0DBD\u0DD0\u0DB6\u0DD9\u0DBA\u0DD2. \u0DC4\u0DD0\u0DB8 \u0D9C\u0DD0\u0DBD\u0DB4\u0DD3\u0DB8\u0D9A\u0DCA \u0DC3\u0DB3\u0DC4\u0DCF\u0DB8, \u0D94\u0DBA\u0DCF\u0DA7 \u0DB8\u0DDA \u0DAF\u0DDA\u0DC0\u0DBD\u0DCA \u0D9A\u0DBB\u0DB1\u0DCA\u0DB1 \u0DB4\u0DD4\u0DC5\u0DD4\u0DC0\u0DB1\u0DCA:
          </Paragraph>
          <QuickRefTable
            headers={{ want: "\u0D9A\u0DCA\u200D\u0DBB\u0DD2\u0DBA\u0DCF\u0DC0", goto: "\u0D91\u0D9A\u0DD9\u0DB1\u0DCA \u0DC0\u0DD9\u0DB1\u0DCA\u0DB1\u0DDA \u0DB8\u0DDC\u0D9A\u0D9A\u0DCA\u0DAF" }}
            rows={[
              { want: "\u0DC3\u0DB8\u0DCF\u0DBD\u0DDD\u0DA0\u0DB1\u0DBA \u0D9A\u0DBB\u0DB1\u0DCA\u0DB1", goto: "\u0D9C\u0DDC\u0DC0\u0DD2\u0DBA\u0DCF\u0D9C\u0DDA \u0DB1\u0DB8, \u0DC3\u0DCA\u0DAD\u0DCF\u0DB1\u0DBA, \u0DAD\u0DD2\u0DBA\u0DD9\u0DB1 \u0DB4\u0DCA\u200D\u0DBB\u0DB8\u0DCF\u0DAB\u0DBA, \u0D89\u0DBD\u0DCA\u0DBD\u0DB1 \u0DB8\u0DD2\u0DBD, \u0DAD\u0DAD\u0DCA\u0DAD\u0DCA\u0DC0 \u0DC1\u0DCA\u200D\u0DBB\u0DDA\u0DAB\u0DD2\u0DBA, \u0DC3\u0DC4 \u0DAF\u0DD0\u0DB1\u0DCA\u0DC0\u0DD3\u0DB8\u0DDA \u0DA1\u0DCF\u0DBA\u0DCF\u0DBB\u0DD6\u0DB4\u0DBA \u0DB6\u0DBD\u0DB1\u0DCA\u0DB1" },
              { want: "\u0DB4\u0DD2\u0DC5\u0DD2\u0D9C\u0DB1\u0DCA\u0DB1", goto: "\u0D94\u0DBA\u0DCF \u0DB8\u0DDA \u0D9C\u0DDC\u0DC0\u0DD2\u0DBA\u0DCF\u0D9C\u0DD9\u0DB1\u0DCA \u0DB8\u0DD2\u0DBD\u0DAF\u0DD3 \u0D9C\u0DB1\u0DCA\u0DB1 \u0D91\u0D9A\u0DA7 \u0D91\u0D9A\u0D9F \u0DC0\u0DD9\u0DB1\u0DC0\u0DCF. \u0D9C\u0DDC\u0DC0\u0DD2\u0DBA\u0DCF\u0DA7 \u0DAF\u0DD0\u0DB1\u0DD4\u0DB8\u0DCA \u0DAF\u0DD9\u0DB1\u0DC0\u0DCF" },
              { want: "\u0DB4\u0DCA\u200D\u0DBB\u0DAD\u0DD2\u0D9A\u0DCA\u0DC2\u0DDA\u0DB4 \u0D9A\u0DBB\u0DB1\u0DCA\u0DB1", goto: "\u0D8B\u0DB1\u0DB1\u0DCA\u0DAF\u0DD4\u0DC0\u0D9A\u0DCA \u0DB1\u0DD0\u0DC4\u0DD0. \u0D9C\u0DD0\u0DBD\u0DB4\u0DD3\u0DB8 \u0D89\u0DC0\u0DAD\u0DCA \u0DC0\u0DD9\u0DB1\u0DC0\u0DCF" },
              { want: "\u0DB1\u0DDC\u0DC3\u0DBD\u0D9A\u0DCF \u0DC4\u0DBB\u0DD2\u0DB1\u0DCA\u0DB1", goto: "\u0DAF\u0DD0\u0DB1\u0DA7 \u0DB4\u0DCA\u200D\u0DBB\u0DAD\u0DD2\u0D9A\u0DCA\u0DC2\u0DDA\u0DB4 \u0DB1\u0DDC\u0D9A\u0DBB \u0DB1\u0DDC\u0DC3\u0DBD\u0D9A\u0DCF \u0DC4\u0DBB\u0DD2\u0DB1\u0DCA\u0DB1" },
              { want: "\u0DC3\u0DB8\u0DCA\u0DB4\u0DD6\u0DBB\u0DCA\u0DAB \u0D9A\u0DBB\u0DB1\u0DCA\u0DB1", goto: "\u0DB7\u0DCF\u0DAB\u0DCA\u0DA9 \u0DBD\u0DD0\u0DB6\u0DD4\u0DAB\u0DCF\u0DA7 \u0DB4\u0DC3\u0DCA\u0DC3\u0DDA, \u0D9C\u0DD0\u0DBD\u0DB4\u0DD3\u0DB8 \u0DC3\u0DB8\u0DCA\u0DB4\u0DD6\u0DBB\u0DCA\u0DAB \u0D9A\u0DC5\u0DCF \u0D9A\u0DD2\u0DBA\u0DBD\u0DCF \u0DC3\u0DBD\u0D9A\u0DD4\u0DAB\u0DD4 \u0D9A\u0DBB\u0DB1\u0DCA\u0DB1" },
            ]}
          />
          <TipBox>
            <strong>\u0D94\u0DB6\u0DDA \u0DA2\u0DCF\u0DBD\u0DBA \u0D9C\u0DDC\u0DA9\u0DB1\u0D9F\u0DCF \u0D9C\u0DB1\u0DCA\u0DB1:</strong> \u0D9A\u0DCF\u0DBD\u0DBA\u0DAD\u0DCA \u0D91\u0D9A\u0DCA\u0D9A, \u0D94\u0DB6\u0DDA \u0D9C\u0DD0\u0DBD\u0DB4\u0DD3\u0DB8\u0DCA \u0D89\u0DAD\u0DD2\u0DC4\u0DCF\u0DC3\u0DBA \u0DC0\u0DD2\u0DC1\u0DCA\u0DC0\u0DCF\u0DC3\u0DC0\u0DB1\u0DCA\u0DAD\u0DB8 \u0D9C\u0DDC\u0DC0\u0DD3\u0DB1\u0DCA \u0D9A\u0DC0\u0DD4\u0DAF \u0D9A\u0DD2\u0DBA\u0DBD\u0DCF \u0DC4\u0DB3\u0DD4\u0DB1\u0DCF\u0D9C\u0DB1\u0DCA\u0DB1 \u0D8B\u0DAF\u0DC0\u0DD4 \u0DC0\u0DD9\u0DB1\u0DC0\u0DCF. \u0DC3\u0DB8\u0DCA\u0DB4\u0DD6\u0DBB\u0DCA\u0DAB \u0D9A\u0DBB\u0DB4\u0DD4 \u0D9C\u0DD0\u0DBD\u0DB4\u0DD3\u0DB8\u0DCA \u0DC0\u0DD2\u0DC1\u0DCA\u0DC0\u0DCF\u0DC3\u0DBA \u0D9C\u0DDC\u0DA9\u0DB1\u0D9F\u0DB1 \u0D85\u0DAD\u0DBB \u0D85\u0DB1\u0DCF\u0D9C\u0DAD \u0D9C\u0DD0\u0DBD\u0DB4\u0DD3\u0DB8\u0DCA \u0DC0\u0DD0\u0DA9\u0DD2 \u0DAF\u0DD2\u0DBA\u0DD4\u0DAB\u0DD4 \u0D9A\u0DBB\u0DB1\u0DC0\u0DCF.
          </TipBox>
        </>
      ),
    },
    /* ---------- 5 ---------- */
    {
      number: 5,
      title: "\u0D85\u0DC3\u0DCA\u0DC0\u0DB1\u0DD4 \u0DBD\u0DD0\u0DBA\u0DD2\u0DC3\u0DCA\u0DAD\u0DD4 \u0DB4\u0DD2\u0DBB\u0DD2\u0D9A\u0DCA\u0DC3\u0DD3\u0DB8",
      content: (
        <>
          <Paragraph>
            AI \u0D9C\u0DD0\u0DBD\u0DB4\u0DD3\u0DB8\u0DCA \u0D91\u0DB1\u0D9A\u0DB8\u0DCA \u0DB6\u0DBD\u0DB1\u0DCA \u0D89\u0DB1\u0DCA\u0DB1\u0DC0\u0DCF\u0DA7 \u0D85\u0DB8\u0DAD\u0DBB\u0DC0, \u0D94\u0DB6\u0DA7 \u0DB4\u0DCA\u0DBD\u0DD0\u0DA7\u0DCA\u0DC6\u0DDD\u0DB8\u0DCA \u0D91\u0D9A\u0DDA \u0D89\u0DB1\u0DCA\u0DB1 \u0DC4\u0DD0\u0DB8 \u0D9C\u0DDC\u0DC0\u0DD2\u0DBA\u0DD9\u0D9A\u0DD4\u0D9C\u0DD9\u0DB1\u0DCA\u0DB8 \u0DAD\u0DD2\u0DBA\u0DD9\u0DB1 \u0D85\u0DC3\u0DCA\u0DC0\u0DB1\u0DD4 \u0D9A\u0DCA\u200D\u0DBB\u0DD2\u0DBA\u0DCF\u0DC1\u0DD3\u0DBD\u0DD3\u0DC0 \u0DB4\u0DD2\u0DBB\u0DD2\u0D9A\u0DCA\u0DC3\u0DB1\u0DCA\u0DB1 \u0DB4\u0DD4\u0DC5\u0DD4\u0DC0\u0DB1\u0DCA.
          </Paragraph>
          <StepTable
            steps={[
              { step: 1, action: "Marketplace \u0D91\u0D9A\u0DA7 \u0DBA\u0DB1\u0DCA\u0DB1", details: "navigation \u0D91\u0D9A\u0DD9\u0DB1\u0DCA \"Marketplace\" \u0D91\u0D9A \u0DA7\u0DA7\u0DCA\u0DA7\u0DD4 \u0D9A\u0DBB\u0DB1\u0DCA\u0DB1" },
              { step: 2, action: "\u0DB4\u0DD2\u0DBB\u0DD2\u0D9A\u0DCA\u0DC3\u0DB1\u0DCA\u0DB1 \u0DC4\u0DDD \u0DB4\u0DD9\u0DBB\u0DC4\u0DB1\u0DCA \u0D9A\u0DBB\u0DB1\u0DCA\u0DB1", details: "\u0DB6\u0DDD\u0D9C \u0DC0\u0DBB\u0DCA\u0D9C\u0DBA, \u0DAF\u0DD2\u0DC3\u0DCA\u0DAD\u0DCA\u200D\u0DBB\u0DD2\u0D9A\u0DCA\u0D9A\u0DBA, \u0DAD\u0DAD\u0DCA\u0DAD\u0DCA\u0DC0 Grade \u0D91\u0D9A \u0DC4\u0DDD \u0DB8\u0DD2\u0DBD \u0DB4\u0DBB\u0DCF\u0DC3\u0DBA \u0D85\u0DB1\u0DD4\u0DC0 \u0DB4\u0DD9\u0DBB\u0DC4\u0DB1\u0DCA \u0D9A\u0DBB\u0DB1\u0DCA\u0DB1" },
              { step: 3, action: "\u0DAF\u0DD0\u0DB1\u0DCA\u0DC0\u0DD3\u0DB8\u0DDA \u0DC0\u0DD2\u0DC3\u0DCA\u0DAD\u0DBB \u0DB6\u0DBD\u0DB1\u0DCA\u0DB1", details: "\u0DB4\u0DCA\u200D\u0DBB\u0DB8\u0DCF\u0DAB\u0DBA, \u0DB8\u0DD2\u0DBD, \u0DA1\u0DCF\u0DBA\u0DCF\u0DBB\u0DD6\u0DB4, \u0D9C\u0DDC\u0DC0\u0DD2 \u0DB4\u0DD0\u0DAD\u0DD2\u0D9A\u0DA9 \u0DC3\u0DC4 \u0DC3\u0DCA\u0DAD\u0DCF\u0DB1\u0DBA \u0DB6\u0DBD\u0DB1\u0DCA\u0DB1" },
              { step: 4, action: "\u0DC3\u0DB8\u0DCA\u0DB6\u0DB1\u0DCA\u0DB0 \u0DC0\u0DB1\u0DCA\u0DB1 \u0DC4\u0DDD \u0D9C\u0DD0\u0DBD\u0DB4\u0DD3\u0DB8\u0D9A\u0DCA \u0D9A\u0DBB\u0DB1\u0DCA\u0DB1", details: "\u0D9C\u0DDC\u0DC0\u0DD2\u0DBA\u0DCF \u0DC3\u0DB8\u0D9F \u0D9C\u0DD0\u0DBD\u0DB4\u0DD3\u0DB8\u0D9A\u0DCA \u0D86\u0DBB\u0DB8\u0DCA\u0DB7 \u0D9A\u0DD2\u0DBB\u0DD3\u0DB8\u0DA7 \u0D9A\u0DD0\u0DB8\u0DD0\u0DAD\u0DCA\u0DAD \u0DB4\u0DC5 \u0D9A\u0DBB\u0DB1\u0DCA\u0DB1" },
            ]}
          />
        </>
      ),
    },
    /* ---------- 6 ---------- */
    {
      number: 6,
      title: "\u0DC3\u0DD0\u0DB4\u0DBA\u0DD4\u0DB8\u0DCA \u0DC0\u0DD9\u0DC5\u0DAF\u0DB4\u0DDC\u0DC5",
      content: (
        <>
          <Paragraph>
            \u0D94\u0DB6\u0DA7 \u0DC3\u0DAD\u0DCA\u200D\u0DBA\u0DCF\u0DB4\u0DD2\u0DAD \u0DC3\u0DD0\u0DB4\u0DBA\u0DD4\u0DB8\u0DCA\u0D9A\u0DBB\u0DD4\u0DC0\u0DB1\u0DCA\u0D9C\u0DD9\u0DB1\u0DCA \u0DBD\u0DD0\u0DB6\u0DD9\u0DB1 \u0D9C\u0DDC\u0DC0\u0DD2\u0DAD\u0DD0\u0DB1 \u0D86\u0DAF\u0DCF\u0DB1 \u0DBD\u0DD0\u0DBA\u0DD2\u0DC3\u0DCA\u0DAD\u0DD4\u0DAD\u0DCA \u0DB6\u0DBD\u0DB1\u0DCA\u0DB1 \u0DB4\u0DD4\u0DC5\u0DD4\u0DC0\u0DB1\u0DCA &mdash; \u0DB6\u0DD3\u0DA2, \u0DB4\u0DDC\u0DC4\u0DDC\u0DBB, \u0DB8\u0DD9\u0DC0\u0DBD\u0DB8\u0DCA \u0DC3\u0DC4 \u0D8B\u0DB4\u0D9A\u0DBB\u0DAB \u0DC0\u0D9C\u0DDA \u0DAF\u0DDA\u0DC0\u0DBD\u0DCA. \u0D94\u0DB6 \u0DB1\u0DD2\u0DC2\u0DCA\u0DB4\u0DCF\u0DAF\u0DB1 \u0D9A\u0DCA\u200D\u0DBB\u0DD2\u0DBA\u0DCF\u0DC0\u0DBD\u0DD2\u0DBA\u0D9A\u0DCA \u0D9A\u0DBB\u0DB1\u0DC0\u0DCF \u0DB1\u0DB8\u0DCA, \u0DB1\u0DD0\u0DAD\u0DCA\u0DB1\u0DB8\u0DCA \u0DC0\u0DA7\u0DD2\u0DB1\u0DCF\u0D9A\u0DB8\u0DCA \u0D91\u0D9A\u0DAD\u0DD4 \u0D9A\u0DC5 \u0DB1\u0DD2\u0DC2\u0DCA\u0DB4\u0DCF\u0DAF\u0DB1 \u0DC3\u0DB3\u0DC4\u0DCF \u0D85\u0DB8\u0DD4\u0DAF\u0DCA\u200D\u0DBB\u0DC0\u0DCA\u200D\u0DBA \u0DBD\u0DB6\u0DCF\u0D9C\u0DB1\u0DCA\u0DB1 \u0D85\u0DC0\u0DC1\u0DCA\u200D\u0DBA \u0DB1\u0DB8\u0DCA, \u0DB8\u0DDA\u0D9A \u0D9C\u0DDC\u0DA9\u0D9A\u0DCA \u0DB4\u0DCA\u200D\u0DBB\u0DBA\u0DDD\u0DA2\u0DB1\u0DC0\u0DAD\u0DCA \u0DC0\u0DD9\u0DBA\u0DD2.
          </Paragraph>
        </>
      ),
    },
    /* ---------- 7 ---------- */
    {
      number: 7,
      title: "\u0DAF\u0DD0\u0DB1\u0DD4\u0DB8\u0DCA\u0DAF\u0DD3\u0DB8\u0DCA",
      content: (
        <>
          <Paragraph>GoviHub \u0D94\u0DB6\u0DA7 \u0DAF\u0DD0\u0DB1\u0DD4\u0DB8\u0DCA\u0DAF\u0DD3\u0DB8\u0DCA \u0D91\u0DC0\u0DB1\u0DD4 \u0DBD\u0DB6\u0DB1\u0DC0\u0DCF:</Paragraph>
          <BulletList
            items={[
              "\u0D94\u0DB6\u0D9C\u0DDA \u0D89\u0DBD\u0DCA\u0DBD\u0DD3\u0DB8\u0DCA \u0DB4\u0DC5\u0D9A\u0DD2\u0DBB\u0DD3\u0DB8\u0DCA \u0DC3\u0DB3\u0DC4\u0DCF \u0D85\u0DBD\u0DD4\u0DAD\u0DCA \u0D9C\u0DDC\u0DC0\u0DD2 \u0D9C\u0DD0\u0DBD\u0DB4\u0DD3\u0DB8\u0DCA",
              "\u0D9C\u0DD0\u0DBD\u0DB4\u0DD3\u0DB8\u0DCA \u0DC0\u0DBD \u0DAD\u0DAD\u0DCA\u0DAD\u0DCA\u0DC0 \u0DBA\u0DCF\u0DC0\u0DAD\u0DCA\u0D9A\u0DCF\u0DBD\u0DD3\u0DB1 \u0D9A\u0DD2\u0DBB\u0DD3\u0DB8\u0DCA (\u0D9C\u0DDC\u0DC0\u0DD2\u0DBA\u0DCF \u0DB7\u0DCF\u0DBB\u0D9C\u0DAD\u0DCA\u0DAD\u0DCF, \u0DC3\u0DB8\u0DCA\u0DB4\u0DD6\u0DBB\u0DCA\u0DAB \u0D9A\u0DC5\u0DCF \u0DC0\u0D9C\u0DDA \u0DAF\u0DDA\u0DC0\u0DBD\u0DCA)",
              "GoviHub \u0DB4\u0DBB\u0DD2\u0DB4\u0DCF\u0DBD\u0D9A\u0DBA\u0DD2\u0DB1\u0DCA\u0D9C\u0DD9\u0DB1\u0DCA \u0DC0\u0DDA\u0DAF\u0DD2\u0D9A\u0DCF\u0DC0\u0DDA \u0DB1\u0DD2\u0DC0\u0DDA\u0DAF\u0DB1",
            ]}
          />
          <Paragraph>
            \u0D94\u0DB6\u0D9C\u0DDA Dashboard \u0D91\u0D9A\u0DDA \u0DAD\u0DD2\u0DBA\u0DD9\u0DB1 \u0DAF\u0DD0\u0DB1\u0DD4\u0DB8\u0DCA\u0DAF\u0DD3\u0DB8\u0DCA \u0DC3\u0DD3\u0DAB\u0DD4\u0DC0 \u0DB1\u0DDC\u0D9A\u0DD2\u0DBA\u0DC0\u0DD6 \u0DAF\u0DD0\u0DB1\u0DD4\u0DB8\u0DCA\u0DAF\u0DD3\u0DB8\u0DCA \u0D9C\u0DAB\u0DB1 \u0DB4\u0DD9\u0DB1\u0DCA\u0DC0\u0DB1\u0DC0\u0DCF. \u0DC4\u0DD0\u0DB8 \u0DAF\u0DD0\u0DB1\u0DD4\u0DB8\u0DCA\u0DAF\u0DD3\u0DB8\u0D9A\u0DCA\u0DB8 \u0DB6\u0DBD\u0DB1\u0DCA\u0DB1 \u0D91\u0D9A \u0D94\u0DB6\u0DB1\u0DCA\u0DB1, \u0D91 \u0DC0\u0D9C\u0DDA\u0DB8 \u0D91\u0DC0\u0DCF \u0D91\u0D9A\u0DD2\u0DB1\u0DCA \u0D91\u0D9A \u0DC4\u0DDD \u0D91\u0D9A\u0DC0\u0DBB\u0DB8 \u0D9A\u0DD2\u0DBA\u0DC0\u0DD6 \u0D91\u0DC0\u0DCF \u0DC0\u0DD2\u0DAF\u0DD2\u0DBA\u0DA7 \u0DC3\u0DBD\u0D9A\u0DD4\u0DAB\u0DD4 \u0D9A\u0DBB\u0DB1\u0DCA\u0DB1 \u0DB4\u0DD4\u0DC5\u0DD4\u0DC0\u0DB1\u0DCA.
          </Paragraph>
        </>
      ),
    },
    /* ---------- 8 ---------- */
    {
      number: 8,
      title: "\u0DC3\u0DD0\u0D9A\u0DC3\u0DD4\u0DB8\u0DCA \u0DC3\u0DC4 \u0DB4\u0DD0\u0DAD\u0DD2\u0D9A\u0DA9",
      content: (
        <>
          <SubHeading>8.1 \u0DB4\u0DD0\u0DAD\u0DD2\u0D9A\u0DA9 \u0DC3\u0DD0\u0D9A\u0DC3\u0DD4\u0DB8\u0DCA</SubHeading>
          <Paragraph>
            \u0D94\u0DB6\u0D9C\u0DDA \u0DC0\u0DCA\u200D\u0DBA\u0DCF\u0DB4\u0DCF\u0DBB \u0DAD\u0DDC\u0DBB\u0DAD\u0DD4\u0DBB\u0DD4 \u0DBA\u0DCF\u0DC0\u0DAD\u0DCA\u0D9A\u0DCF\u0DBD\u0DD3\u0DB1 \u0D9A\u0DBB\u0DB1\u0DCA\u0DB1: \u0DC3\u0DB8\u0DCF\u0D9C\u0DB8\u0DDA \u0DB1\u0DB8, \u0DAF\u0DD4\u0DBB\u0D9A\u0DAD\u0DB1 \u0D85\u0D82\u0D9A\u0DBA, \u0DAF\u0DD2\u0DC3\u0DCA\u0DAD\u0DCA\u200D\u0DBB\u0DD2\u0D9A\u0DCA\u0D9A\u0DBA \u0DC3\u0DC4 \u0DB8\u0DD2\u0DBD\u0DAF\u0DD3 \u0D9C\u0DD0\u0DB1\u0DD3\u0DB8\u0DDA \u0DB8\u0DB1\u0DCF\u0DB4\u0DBA\u0DB1\u0DCA.
          </Paragraph>
          <SubHeading>8.2 \u0DAF\u0DD0\u0DB1\u0DD4\u0DB8\u0DCA\u0DAF\u0DD3\u0DB8\u0DCA \u0DB8\u0DB1\u0DCF\u0DB4\u0DBA\u0DB1\u0DCA</SubHeading>
          <Paragraph>
            \u0D94\u0DB6\u0DA7 \u0DBD\u0DD0\u0DB6\u0DD9\u0DB1 \u0DAF\u0DD0\u0DB1\u0DD4\u0DB8\u0DCA\u0DAF\u0DD3\u0DB8\u0DCA \u0DB4\u0DCF\u0DBD\u0DB1\u0DBA \u0D9A\u0DBB\u0DB1\u0DCA\u0DB1. \u0D9C\u0DD0\u0DC5\u0DB4\u0DD3\u0DB8\u0DCA, \u0DB8\u0DD2\u0DBD \u0DBA\u0DCF\u0DC0\u0DAD\u0DCA\u0D9A\u0DCF\u0DBD\u0DD3\u0DB1 \u0D9A\u0DD2\u0DBB\u0DD3\u0DB8\u0DCA \u0DC3\u0DC4 \u0DB1\u0DD2\u0DC0\u0DDA\u0DAF\u0DB1 \u0DC3\u0DB3\u0DC4\u0DCF \u0D87\u0D9F\u0DC0\u0DD3\u0DB8\u0DCA \u0DC3\u0D9A\u0DCA\u200D\u0DBB\u0DD3\u0DBA \u0D9A\u0DBB\u0DB1\u0DCA\u0DB1 \u0DC4\u0DDD \u0D85\u0D9A\u0DCA\u200D\u0DBB\u0DD3\u0DBA \u0D9A\u0DBB\u0DB1\u0DCA\u0DB1.
          </Paragraph>
          <SubHeading>8.3 \u0DB8\u0DD4\u0DBB\u0DB4\u0DAF\u0DBA \u0DC0\u0DD9\u0DB1\u0DC3\u0DCA \u0D9A\u0DBB\u0DB1\u0DCA\u0DB1</SubHeading>
          <Paragraph>
            \u0DC3\u0DD0\u0D9A\u0DC3\u0DD4\u0DB8\u0DCA &gt; \u0DB8\u0DD4\u0DBB\u0DB4\u0DAF\u0DBA \u0DC0\u0DD9\u0DB1\u0DC3\u0DCA \u0D9A\u0DBB\u0DB1\u0DCA\u0DB1 \u0DC0\u0DD9\u0DAD \u0DBA\u0DB1\u0DCA\u0DB1. \u0DB1\u0DC0 \u0DB8\u0DD4\u0DBB\u0DB4\u0DAF\u0DBA\u0D9A\u0DCA \u0DC3\u0DD0\u0D9A\u0DC3\u0DD3\u0DB8\u0DA7 \u0D94\u0DB6\u0DA7 \u0D94\u0DB6\u0D9C\u0DDA \u0DC0\u0DAD\u0DCA\u0DB8\u0DB1\u0DCA \u0DB8\u0DD4\u0DBB\u0DB4\u0DAF\u0DBA \u0D85\u0DC0\u0DC1\u0DCA\u200D\u0DBA \u0DC0\u0DDA.
          </Paragraph>
        </>
      ),
    },
    /* ---------- 9 ---------- */
    {
      number: 9,
      title: "\u0DB4\u0DCA\u200D\u0DBB\u0DAD\u0DD2\u0DA0\u0DCF\u0DBB \u0DBD\u0DB6\u0DCF\u0DAF\u0DD3\u0DB8",
      content: (
        <>
          <Paragraph>
            GoviHub \u0DAF\u0DD2\u0DBA\u0DD4\u0DAB\u0DD4 \u0D9A\u0DBB\u0DB1\u0DCA\u0DB1 \u0D85\u0DB4\u0DD2\u0DA7 \u0D8B\u0DAF\u0DC0\u0DD4 \u0D9A\u0DBB\u0DB1\u0DCA\u0DB1! More \u0DB8\u0DD9\u0DB1\u0DD4\u0DC0\u0DA7 \u0D9C\u0DD2\u0DC4\u0DD2\u0DB1\u0DCA &quot;Feedback&quot; \u0D9A\u0DD2\u0DBA\u0DB1 \u0D91\u0D9A \u0DAD\u0DDD\u0DBB\u0DBD\u0DCF, \u0D94\u0DBA\u0DCF\u0D9C\u0DDA \u0D85\u0DAF\u0DC4\u0DC3\u0DCA \u0D9A\u0DD2\u0DBA\u0DB1\u0DCA\u0DB1, \u0D9C\u0DD0\u0DA7\u0DBD\u0DD4 \u0DC0\u0DCF\u0DBB\u0DCA\u0DAD\u0DCF \u0D9A\u0DBB\u0DB1\u0DCA\u0DB1, \u0DB1\u0DD0\u0DAD\u0DCA\u0DB1\u0DB8\u0DCA \u0D85\u0DBD\u0DD4\u0DAD\u0DCA \u0DC0\u0DD2\u0DC1\u0DDA\u0DC2\u0DCF\u0D82\u0D9C \u0DBA\u0DDD\u0DA2\u0DB1\u0DCF \u0D9A\u0DBB\u0DB1\u0DCA\u0DB1 \u0DB4\u0DD4\u0DC5\u0DD4\u0DC0\u0DB1\u0DCA.
          </Paragraph>
        </>
      ),
    },
    /* ---------- 10 ---------- */
    {
      number: 10,
      title: "\u0D89\u0D9A\u0DCA\u0DB8\u0DB1\u0DCA \u0DC0\u0DD2\u0DB8\u0DC3\u0DD4\u0DB8",
      content: (
        <QuickRefTable
          headers={{ want: "\u0DB8\u0DA7 \u0D95\u0DB1 \u0DB1\u0DB8\u0DCA...", goto: "\u0DBA\u0DB1\u0DCA\u0DB1..." }}
          rows={[
            { want: "\u0DB8\u0DA7 \u0D9C\u0DB1\u0DCA\u0DB1 \u0D95\u0DB1 \u0DAF\u0DDA \u0DAF\u0DCF\u0DB1\u0DCA\u0DB1", goto: "Demands > Create New" },
            { want: "\u0D9C\u0DDC\u0DC0\u0DD3\u0DB1\u0DCA\u0D9C\u0DD9\u0DB1\u0DCA \u0DBD\u0DD0\u0DB6\u0DD2\u0DBD\u0DCF \u0DAD\u0DD2\u0DBA\u0DD9\u0DB1 \u0D9C\u0DD0\u0DC5\u0DB4\u0DD3\u0DB8\u0DCA \u0DB6\u0DBD\u0DB1\u0DCA\u0DB1", goto: "Matches (navigation)" },
            { want: "\u0DAD\u0DD2\u0DBA\u0DD9\u0DB1 \u0D85\u0DC3\u0DCA\u0DC0\u0DD0\u0DB1\u0DCA\u0DB1 \u0DB6\u0DBD\u0DB1\u0DCA\u0DB1", goto: "Marketplace" },
            { want: "\u0DB8\u0D9C\u0DDA \u0DAF\u0DD0\u0DB1\u0DD4\u0DB8\u0DCA\u0DAF\u0DD3\u0DB8\u0DCA \u0DB6\u0DBD\u0DB1\u0DCA\u0DB1", goto: "Dashboard \u0D91\u0D9A\u0DDA \u0DAD\u0DD2\u0DBA\u0DD9\u0DB1 Notification bell \u0D91\u0D9A" },
            { want: "\u0DB8\u0D9C\u0DDA profile \u0D91\u0D9A update \u0D9A\u0DBB\u0DB1\u0DCA\u0DB1", goto: "Settings" },
            { want: "\u0DB8\u0D9C\u0DDA password \u0D91\u0D9A \u0DC0\u0DD9\u0DB1\u0DC3\u0DCA \u0D9A\u0DBB\u0DB1\u0DCA\u0DB1", goto: "Settings > Change Password" },
            { want: "\u0D85\u0DAF\u0DC4\u0DC3\u0DCA \u0DAF\u0DD9\u0DB1\u0DCA\u0DB1", goto: "More > Feedback" },
          ]}
        />
      ),
    },
  ],
  help: {
    title: "\u0D8B\u0DAF\u0DC0\u0DD4 \u0D95\u0DB1\u0DD9\u0DAF?",
    items: [
      "\u0D87\u0DB4\u0DCA \u0D91\u0D9A\u0DD9\u0DB1\u0DCA \u0DB4\u0DCA\u200D\u0DBB\u0DAD\u0DD2\u0DA0\u0DCF\u0DBB \u0D89\u0DAF\u0DD2\u0DBB\u0DD2\u0DB4\u0DAD\u0DCA \u0D9A\u0DBB\u0DB1\u0DCA\u0DB1 (\u0DAD\u0DC0\u0DAD\u0DCA > \u0DB4\u0DCA\u200D\u0DBB\u0DAD\u0DD2\u0DA0\u0DCF\u0DBB)",
      "\u0D94\u0DB6\u0DDA \u0DB4\u0DCA\u200D\u0DBB\u0DCF\u0DAF\u0DDA\u0DC1\u0DD3\u0DBA GoviHub \u0DC3\u0DB8\u0DCA\u0DB6\u0DB1\u0DCA\u0DB0\u0DD3\u0D9A\u0DBB\u0D9A\u0DC0 \u0DC3\u0DB8\u0DCA\u0DB6\u0DB1\u0DCA\u0DB0 \u0D9A\u0DBB\u0D9C\u0DB1\u0DCA\u0DB1",
      "\u0D85\u0DB4\u0DDA YouTube channel \u0D91\u0D9A\u0DA7 \u0DBA\u0DB1\u0DCA\u0DB1: @GoviHubSriLanka",
    ],
  },
};

/* ------------------------------------------------------------------ */
/*  Page component                                                     */
/* ------------------------------------------------------------------ */

export default function BuyerGuidePage() {
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
            {section.number < 10 && (
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
