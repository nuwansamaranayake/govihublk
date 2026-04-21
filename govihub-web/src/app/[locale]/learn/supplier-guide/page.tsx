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

function StepCard({ step, action, details }: { step: number; action: string; details: string }) {
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

function StepTable({ steps }: { steps: { step: number; action: string; details: string }[] }) {
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

function QuickRefTable({ rows, headers }: { rows: { want: string; goto: string }[]; headers: { want: string; goto: string } }) {
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
/*  Content — English                                                  */
/* ------------------------------------------------------------------ */

const en = {
  meta: {
    title: "GoviHub Spices \u2014 Supplier User Guide",
    subtitle: "Sri Lanka\u2019s AI Spice Marketplace",
    version: "Version 1.0 \u2014 April 2026",
    backLabel: "\u2190 Back to Learn",
    langToggleLabel: "SI",
    printLabel: "Print",
    ctaButton: "Get Started with GoviHub",
    youtubeText: "Watch video tutorials on our YouTube channel",
    youtubeChannel: "@GoviHubSriLanka",
    footer: "GoviHub Spices \u2014 Connecting suppliers to Sri Lanka\u2019s spice farming community",
    footerOrg: "Prepared by AiGNITE Consulting \u2014 April 2026",
  },
  sections: [
    {
      number: 1,
      title: "Getting Started",
      content: (
        <>
          <Paragraph>
            GoviHub Spices gives you direct access to thousands of spice farmers looking for quality farming inputs. List your seeds, fertilizers, tools, and equipment — farmers browse and inquire directly through the app.
          </Paragraph>

          <SubHeading>1.1 What You Need</SubHeading>
          <BulletList
            items={[
              "A smartphone or computer with internet access",
              "Chrome, Safari, or any modern web browser",
              "Photos of your products (listings with photos get more inquiries)",
            ]}
          />
          <TipBox>
            <strong>Install as App:</strong> Visit spices.govihublk.com in Chrome and tap &quot;Add to Home Screen&quot; to use GoviHub like a native app.
          </TipBox>

          <SubHeading>1.2 Creating Your Account</SubHeading>
          <StepTable
            steps={[
              { step: 1, action: "Open GoviHub", details: "Go to spices.govihublk.com in your browser" },
              { step: 2, action: "Tap Register", details: 'On the landing page, tap the "Register" button' },
              { step: 3, action: "Enter Your Details", details: "Username, password, full name, phone number, and district" },
              { step: 4, action: "Select Your Role", details: 'Choose "Supplier" as your role' },
              { step: 5, action: "Complete Your Profile", details: "Enter your business name, product categories, and service area" },
              { step: 6, action: "Set Your Location", details: "Allow GPS access or enter your district" },
              { step: 7, action: "Done!", details: "You will be taken to your Supplier Dashboard" },
            ]}
          />
          <WarningBox>
            <strong>Remember Your Credentials:</strong> Write down your username and password. If you forget them, an admin will need to reset your account.
          </WarningBox>
        </>
      ),
    },
    {
      number: 2,
      title: "Your Dashboard",
      content: (
        <>
          <Paragraph>The supplier dashboard shows your business activity at a glance:</Paragraph>
          <BulletList
            items={[
              "Your active supply listings",
              "Recent farmer inquiries about your products",
              "Notification badge showing unread messages",
            ]}
          />
        </>
      ),
    },
    {
      number: 3,
      title: "Creating Supply Listings",
      content: (
        <>
          <Paragraph>
            A supply listing showcases a product you sell to farmers. Good listings with clear descriptions and photos get the most inquiries.
          </Paragraph>

          <SubHeading>3.1 How to Create a Listing</SubHeading>
          <StepTable
            steps={[
              { step: 1, action: "Go to Listings", details: 'Tap "Listings" from the navigation' },
              { step: 2, action: 'Tap "Create New"', details: "The create listing form will open" },
              { step: 3, action: "Select Category", details: "Choose: Seeds, Fertilizer, Pesticide, Tools & Equipment, or Other" },
              { step: 4, action: "Enter Product Name", details: 'Clear, descriptive name (e.g., "Organic NPK Fertilizer 50kg")' },
              { step: 5, action: "Set Price", details: "Price in Sri Lankan Rupees (LKR). Specify if per unit, per kg, or per bag" },
              { step: 6, action: "Enter Description", details: "Detailed product information: composition, usage instructions, brand, pack size" },
              { step: 7, action: "Set Availability", details: "Whether the product is in stock, delivery area, minimum order quantity" },
              { step: 8, action: "Upload Photos", details: "Clear product photos. Multiple angles help farmers make decisions" },
              { step: 9, action: "Submit", details: "Your listing goes live in the supply marketplace" },
            ]}
          />

          <SubHeading>3.2 Managing Your Listings</SubHeading>
          <BulletList
            items={[
              "Edit \u2014 Update price, description, availability, or photos at any time",
              "Delete \u2014 Remove products you no longer sell",
            ]}
          />
          <TipBox>
            <strong>Listing Tips:</strong> Keep your inventory current \u2014 remove or mark products as out of stock when unavailable. Farmers lose trust in suppliers with outdated listings. Include pack sizes and prices clearly.
          </TipBox>
        </>
      ),
    },
    {
      number: 4,
      title: "Handling Farmer Inquiries",
      content: (
        <>
          <Paragraph>When a farmer is interested in your product, they send an inquiry through the app.</Paragraph>
          <StepTable
            steps={[
              { step: 1, action: "Go to Inquiries", details: 'Tap "Inquiries" from the navigation' },
              { step: 2, action: "View Inquiry", details: "See the farmer\u2019s name, location, the product they\u2019re asking about, and their message" },
              { step: 3, action: "Respond", details: "Reply with availability, pricing, delivery options, or any additional details" },
            ]}
          />
          <TipBox>
            <strong>Response Time Matters:</strong> Farmers often need supplies urgently. Quick responses build your reputation and increase repeat business.
          </TipBox>
        </>
      ),
    },
    {
      number: 5,
      title: "Notifications",
      content: (
        <>
          <Paragraph>GoviHub sends you notifications for:</Paragraph>
          <BulletList
            items={[
              "New farmer inquiries about your products",
              "Platform announcements from GoviHub admins",
            ]}
          />
          <Paragraph>
            The notification bell on your dashboard shows unread notifications. Tap to view all, and mark as read individually or all at once.
          </Paragraph>
        </>
      ),
    },
    {
      number: 6,
      title: "Settings & Profile",
      content: (
        <>
          <SubHeading>6.1 Profile Settings</SubHeading>
          <Paragraph>
            Update your business information: business name, phone number, district, product categories, and service area.
          </Paragraph>
          <SubHeading>6.2 Notification Preferences</SubHeading>
          <Paragraph>Control which notifications you receive.</Paragraph>
          <SubHeading>6.3 Change Password</SubHeading>
          <Paragraph>
            Go to Settings &gt; Change Password. You&apos;ll need your current password to set a new one.
          </Paragraph>
        </>
      ),
    },
    {
      number: 7,
      title: "Giving Feedback",
      content: (
        <>
          <Paragraph>
            Help us improve GoviHub! Go to the More menu and tap &quot;Feedback&quot; to share your thoughts, report issues, or suggest features.
          </Paragraph>
        </>
      ),
    },
    {
      number: 8,
      title: "Quick Reference",
      content: (
        <>
          <QuickRefTable
            headers={{ want: "I want to...", goto: "Go to..." }}
            rows={[
              { want: "List a product for sale", goto: "Listings > Create New" },
              { want: "See farmer inquiries", goto: "Inquiries (navigation)" },
              { want: "Update my listings", goto: "Listings > tap any listing to edit" },
              { want: "See my notifications", goto: "Notification bell on dashboard" },
              { want: "Update my profile", goto: "Settings" },
              { want: "Change my password", goto: "Settings > Change Password" },
              { want: "Give feedback", goto: "More > Feedback" },
            ]}
          />
        </>
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
/*  Content — Sinhala                                                  */
/* ------------------------------------------------------------------ */

const si = {
  meta: {
    title: "GoviHub Spices \u2014 \u0DC3\u0DD0\u0DB4\u0DBA\u0DD4\u0DB8\u0DCA\u0D9A\u0DBB\u0DD4\u0DC0\u0DB1\u0DCA \u0DC3\u0DB3\u0DC4\u0DCF \u0DB4\u0DBB\u0DD2\u0DC1\u0DD3\u0DBD\u0D9A \u0DB8\u0DCF\u0DBB\u0DCA\u0D9C\u0DDD\u0DB4\u0DAF\u0DD0\u0DC1\u0DBA",
    subtitle: "\u0DC1\u0DCA\u200D\u0DBB\u0DD3 \u0DBD\u0D82\u0D9A\u0DCF\u0DC0\u0DD9\u0DA7 AI \u0D9A\u0DD4\u0DC5\u0DD4\u0DB6\u0DA9\u0DD4 \u0DC0\u0DD9\u0DC5\u0DB3\u0DB4\u0DDC\u0DC5",
    version: "\u0DC3\u0D82\u0DC3\u0DCA\u0D9A\u0DBB\u0DAB\u0DBA 1.0 \u2014 2026 \u0D85\u0DB4\u0DCA\u200D\u0DBB\u0DD0\u0DBD\u0DCA",
    backLabel: "\u2190 \u0D89\u0D9C\u0DD9\u0DB1\u0DD3\u0DB8 \u0DC0\u0DBD\u0DA7",
    langToggleLabel: "EN",
    printLabel: "\u0DB8\u0DD4\u0DAF\u0DCA\u200D\u0DBB\u0DAB\u0DBA",
    ctaButton: "GoviHub \u0DC3\u0DB8\u0D9F \u0D86\u0DBB\u0DB8\u0DCA\u0DB7 \u0D9A\u0DBB\u0DB1\u0DCA\u0DB1",
    youtubeText: "\u0D85\u0DB4\u0D9C\u0DD9 YouTube \u0DB1\u0DCF\u0DBD\u0DD2\u0D9A\u0DCF\u0DC0\u0DD0 \u0DC0\u0DD3\u0DA9\u0DD2\u0DBA\u0DDD \u0DB1\u0DBB\u0DB6\u0DB1\u0DCA\u0DB1",
    youtubeChannel: "@GoviHubSriLanka",
    footer: "GoviHub Spices \u2014 \u0DC1\u0DCA\u200D\u0DBB\u0DD3 \u0DBD\u0D82\u0D9A\u0DCF\u0DC0\u0DD0 \u0D9A\u0DD4\u0DC5\u0DD4\u0DB6\u0DA9\u0DD4 \u0DC0\u0D9C\u0DCF \u0D9A\u0DBB\u0DB1 \u0DB4\u0DCA\u200D\u0DBB\u0DA2\u0DCF\u0DC0\u0DA7 \u0DC3\u0DD0\u0DB4\u0DBA\u0DD4\u0DB8\u0DCA\u0D9A\u0DBB\u0DD4\u0DC0\u0DB1\u0DCA \u0DC3\u0DB8\u0DCA\u0DB6\u0DB1\u0DCA\u0DB0 \u0D9A\u0DBB\u0DB8\u0DD2\u0DB1\u0DCA",
    footerOrg: "AiGNITE Consulting \u0DC0\u0DD2\u0DC3\u0DD2\u0DB1\u0DCA \u0DC3\u0D9A\u0DC3\u0DCA \u0D9A\u0DBB\u0DB1 \u0DBD\u0DAF\u0DD3 \u2014 April 2026",
  },
  sections: [
    {
      number: 1,
      title: "\u0DB4\u0DA7\u0DB1\u0DCA \u0D9C\u0DB1\u0DD2\u0DB8\u0DD4",
      content: (
        <>
          <Paragraph>
            GoviHub Spices \u0DC4\u0DBB\u0DC4\u0DCF \u0D94\u0DB6\u0DA7, \u0DC4\u0DDC\u0DB3 \u0DAD\u0DAD\u0DCA\u0DAD\u0DCA\u0DC0\u0DBA\u0DD0 \u0D9A\u0DD8\u0DC2\u0DD2 \u0D86\u0DAF\u0DCF\u0DB1 \u0DC4\u0DDC\u0DBA\u0DB1 \u0DAF\u0DC4\u0DC3\u0DCA \u0D9C\u0DAB\u0DB1\u0DCA \u0D9A\u0DD4\u0DC5\u0DD4\u0DB6\u0DA9\u0DD4 \u0D9C\u0DDC\u0DC0\u0DD3\u0DB1\u0DCA\u0DC0 \u0D9A\u0DD9\u0DBD\u0DD2\u0DB1\u0DCA\u0DB8 \u0DC3\u0DB8\u0DCA\u0DB6\u0DB1\u0DCA\u0DB0 \u0D9A\u0DBB\u0D9C\u0DB1\u0DCA\u0DB1 \u0DB4\u0DD4\u0DC5\u0DD4\u0DC0\u0DB1\u0DCA. \u0D94\u0DB6\u0DD0 \u0DB6\u0DD3\u0DA2, \u0DB4\u0DDC\u0DC4\u0DDC\u0DBB, \u0DB8\u0DD9\u0DC0\u0DBD\u0DB8\u0DCA \u0DC3\u0DC4 \u0D89\u0DB4\u0D9A\u0DBB\u0DAB \u0DB8\u0DD9\u0DC4\u0DD2 \u0DBD\u0DD0\u0DBA\u0DD2\u0DC3\u0DCA\u0DAD\u0DD4\u0D9C\u0DAD \u0D9A\u0DBB\u0DB1\u0DCA\u0DB1 \u2014 \u0D9C\u0DDC\u0DC0\u0DD3\u0DB1\u0DCA\u0DA7 \u0D87\u0DB4\u0DCA \u0D91\u0D9A \u0DC4\u0DBB\u0DC4\u0DCF \u0D9A\u0DD9\u0DBD\u0DD2\u0DB1\u0DCA\u0DB8 \u0D92\u0DC0\u0DCF \u0DB6\u0DBD\u0DBD\u0DCF \u0DC0\u0DD2\u0DC3\u0DCA\u0DAD\u0DBB \u0D85\u0DC4\u0DB1\u0DCA\u0DB1 \u0DB4\u0DD4\u0DC5\u0DD4\u0DC0\u0DB1\u0DCA.
          </Paragraph>

          <SubHeading>1.1 \u0D94\u0DB6\u0DA7 \u0D85\u0DC0\u0DC1\u0DCA\u200D\u0DBA \u0DAF\u0DD0\u0DC0\u0DBD\u0DCA</SubHeading>
          <BulletList
            items={[
              "\u0D85\u0DB1\u0DCA\u0DAD\u0DBB\u0DCA\u0DA2\u0DCF\u0DBD \u0DC3\u0DB8\u0DCA\u0DB6\u0DB1\u0DCA\u0DB0\u0DAD\u0DCF\u0DC0\u0DBA\u0D9A\u0DCA \u0DAD\u0DD2\u0DBA\u0DD9\u0DB1 \u0DC3\u0DCA\u0DB8\u0DCF\u0DBB\u0DCA\u0DA7\u0DCA\u0DB4\u0DDD\u0DB1\u0DCA \u0D91\u0D9A\u0D9A\u0DCA \u0DC4\u0DDD \u0DB4\u0DBB\u0DD2\u0D9C\u0DAB\u0D9A\u0DBA\u0D9A\u0DCA",
              "Chrome, Safari, \u0DC4\u0DDD \u0DC0\u0DD9\u0DB1\u0DAD\u0DCA \u0D95\u0DB1\u0DD0\u0DB8 \u0DB1\u0DC0\u0DD3\u0DB1 \u0DC0\u0DD9\u0DB6\u0DCA \u0DB6\u0DCA\u200D\u0DBB\u0DC0\u0DD4\u0DC3\u0DBB\u0DBA\u0D9A\u0DCA",
              "\u0D94\u0DB6\u0DD0 \u0DB1\u0DD2\u0DC2\u0DCA\u0DB4\u0DCF\u0DAF\u0DB1\u0DC0\u0DBD \u0DA1\u0DCF\u0DBA\u0DCF\u0DBB\u0DD6\u0DB4 (\u0DA1\u0DCF\u0DBA\u0DCF\u0DBB\u0DD6\u0DB4 \u0DAD\u0DD2\u0DBA\u0DD9\u0DB1 \u0DBD\u0DD0\u0DBA\u0DD2\u0DC3\u0DCA\u0DAD\u0DD4 \u0DC0\u0DBD\u0DA7 \u0DC0\u0DD0\u0DA9\u0DD2 \u0DC0\u0DD2\u0DB8\u0DC3\u0DD3\u0DB8\u0DCA \u0DBD\u0DD0\u0DB6\u0DD9\u0DB1\u0DC0\u0DCF)",
            ]}
          />
          <TipBox>
            <strong>\u0D87\u0DB4\u0DCA \u0D91\u0D9A\u0D9A\u0DCA \u0DC0\u0DD2\u0DAF\u0DD2\u0DBA\u0DA7 \u0DC3\u0DCA\u0DAD\u0DCF\u0DB4\u0DB1\u0DBA \u0D9A\u0DBB\u0DB1\u0DCA\u0DB1:</strong> Chrome \u0DB6\u0DCA\u200D\u0DBB\u0DC0\u0DD4\u0DC3\u0DBB\u0DBA\u0DD9\u0DB1\u0DCA spices.govihublk.com \u0DC0\u0DD9\u0DB6\u0DCA \u0D85\u0DA9\u0DC0\u0DD2\u0DBA\u0DA7 \u0D9C\u0DD2\u0DC4\u0DD2\u0DB1\u0DCA, GoviHub \u0D87\u0DB4\u0DCA \u0D91\u0D9A\u0D9A\u0DCA \u0DC0\u0D9C\u0DD0 \u0DB4\u0DCF\u0DC0\u0DD2\u0DA0\u0DCA\u0DA0\u0DD2 \u0D9A\u0DBB\u0DB1\u0DCA\u0DB1 &quot;Add to Home Screen&quot; \u0D9A\u0DD2\u0DBA\u0DB1 \u0D91\u0D9A \u0DA7\u0DD0\u0DB4\u0DCA \u0D9A\u0DBB\u0DB1\u0DCA\u0DB1.
          </TipBox>

          <SubHeading>1.2 \u0D94\u0DB6\u0DD0 \u0D9C\u0DD2\u0DAB\u0DD4\u0DB8 \u0DC4\u0DAF\u0DB8\u0DD4</SubHeading>
          <StepTable
            steps={[
              { step: 1, action: "GoviHub \u0DC0\u0DD2\u0DC0\u0DD8\u0DAD \u0D9A\u0DBB\u0DB1\u0DCA\u0DB1", details: "\u0D94\u0DB6\u0DD0 \u0DB6\u0DCA\u200D\u0DBB\u0DC0\u0DD4\u0DC3\u0DBB\u0DBA\u0DD9\u0DB1\u0DCA spices.govihublk.com \u0DC0\u0DD9\u0DAD \u0DBA\u0DB1\u0DCA\u0DB1" },
              { step: 2, action: "Register \u0DA7\u0DD0\u0DB4\u0DCA \u0D9A\u0DBB\u0DB1\u0DCA\u0DB1", details: "\u0DB8\u0DD4\u0DBD\u0DCA \u0DB4\u0DD2\u0DA7\u0DD4\u0DC0\u0DD0 \u0DAD\u0DD2\u0DBA\u0DD9\u0DB1 \u201CRegister\u201D \u0DB6\u0DDC\u0DAD\u0DCA\u0DAD\u0DB8 \u0DA7\u0DD0\u0DB4\u0DCA \u0D9A\u0DBB\u0DB1\u0DCA\u0DB1" },
              { step: 3, action: "\u0D94\u0DB6\u0DD0 \u0DC0\u0DD2\u0DC3\u0DCA\u0DAD\u0DBB \u0D87\u0DAD\u0DD4\u0DC5\u0DAD\u0DCA \u0D9A\u0DBB\u0DB1\u0DCA\u0DB1", details: "\u0DB4\u0DBB\u0DD2\u0DC1\u0DD3\u0DBD\u0D9A \u0DB1\u0DCF\u0DB8\u0DBA (Username), \u0DB8\u0DD4\u0DBB\u0DB4\u0DAF\u0DBA (password), \u0DC3\u0DB8\u0DCA\u0DB4\u0DD6\u0DBB\u0DCA\u0DAB \u0DB1\u0DB8, \u0DAF\u0DD4\u0DBB\u0D9A\u0DAD\u0DB1 \u0D85\u0D82\u0D9A\u0DBA \u0DC3\u0DC4 \u0DAF\u0DD2\u0DC3\u0DCA\u0DAD\u0DCA\u200D\u0DBB\u0DD2\u0D9A\u0DCA\u0D9A\u0DBA" },
              { step: 4, action: "\u0D94\u0DB6\u0DD0 \u0DB7\u0DD6\u0DB8\u0DD2\u0D9A\u0DCF\u0DC0 \u0DAD\u0DDD\u0DBB\u0DB1\u0DCA\u0DB1", details: "\u201CSupplier\u201D \u0DBD\u0DD9\u0DC3 \u0D94\u0DB6\u0DD0 \u0DB7\u0DD6\u0DB8\u0DD2\u0D9A\u0DCF\u0DC0 \u0DAD\u0DDD\u0DBB\u0DB1\u0DCA\u0DB1" },
              { step: 5, action: "\u0D94\u0DB6\u0DD0 \u0DB4\u0DD0\u0DAD\u0DD2\u0D9A\u0DA9 \u0DC3\u0DB8\u0DCA\u0DB4\u0DD6\u0DBB\u0DCA\u0DAB \u0D9A\u0DBB\u0DB1\u0DCA\u0DB1", details: "\u0D94\u0DB6\u0DD0 \u0DC0\u0DCA\u200D\u0DBA\u0DCF\u0DB4\u0DCF\u0DBB\u0DBA\u0DD0 \u0DB1\u0DB8, \u0DB1\u0DD2\u0DC2\u0DCA\u0DB4\u0DCF\u0DAF\u0DB1 \u0DC0\u0DBB\u0DCA\u0D9C \u0DC3\u0DC4 \u0DC3\u0DD0\u0DC0\u0DCF \u0DC3\u0DB4\u0DBA\u0DB1 \u0DB4\u0DCA\u200D\u0DBB\u0DAF\u0DD0\u0DC1\u0DBA \u0D87\u0DAD\u0DD4\u0DC5\u0DAD\u0DCA \u0D9A\u0DBB\u0DB1\u0DCA\u0DB1" },
              { step: 6, action: "\u0D94\u0DB6\u0DD0 \u0DC3\u0DCA\u0DAD\u0DCF\u0DB1\u0DBA \u0DC3\u0D9A\u0DC3\u0DB1\u0DCA\u0DB1", details: "GPS \u0DB4\u0DCA\u200D\u0DBB\u0DC0\u0DD0\u0DC1\u0DBA\u0DA7 \u0D89\u0DA9 \u0DAF\u0DD9\u0DB1\u0DCA\u0DB1 \u0DC4\u0DDD \u0D94\u0DB6\u0DD0 \u0DAF\u0DD2\u0DC3\u0DCA\u0DAD\u0DCA\u200D\u0DBB\u0DD2\u0D9A\u0DCA\u0D9A\u0DBA \u0D87\u0DAD\u0DD4\u0DC5\u0DAD\u0DCA \u0D9A\u0DBB\u0DB1\u0DCA\u0DB1" },
              { step: 7, action: "\u0D85\u0DC0\u0DC3\u0DB1\u0DCA\u0DBA\u0DD2!", details: "\u0D94\u0DB6\u0DC0 \u0D94\u0DB6\u0DD0 Supplier Dashboard \u0D91\u0D9A\u0DA7 \u0DBA\u0DDC\u0DB8\u0DD4 \u0D9A\u0DBB\u0DB1\u0DD4 \u0D87\u0DAD" },
            ]}
          />
          <WarningBox>
            <strong>\u0D94\u0DB6\u0DD0 \u0DB4\u0DD2\u0DC0\u0DD2\u0DC3\u0DD4\u0DB8\u0DCA \u0DAD\u0DDC\u0DBB\u0DAD\u0DD4\u0DBB\u0DD4 \u0DB8\u0DAD\u0D9A \u0DAD\u0DB6\u0DCF \u0D9C\u0DB1\u0DCA\u0DB1:</strong> \u0D94\u0DB6\u0DD0 \u0DB4\u0DBB\u0DD2\u0DC1\u0DD3\u0DBD\u0D9A \u0DB1\u0DCF\u0DB8\u0DBA (username) \u0DC3\u0DC4 \u0DB8\u0DD4\u0DBB\u0DB4\u0DAF\u0DBA (password) \u0DBD\u0DD2\u0DBA\u0DCF \u0DAD\u0DB6\u0DCF \u0D9C\u0DB1\u0DCA\u0DB1. \u0D94\u0DB6\u0DA7 \u0D92\u0DC0\u0DCF \u0D85\u0DB8\u0DAD\u0D9A \u0DC0\u0DD4\u0DAB\u0DDC\u0DAD\u0DCA, \u0DB4\u0DBB\u0DD2\u0DB4\u0DCF\u0DBD\u0D9A\u0DBA\u0DD9\u0D9A\u0DD4\u0DA7 (admin) \u0D94\u0DB6\u0DD0 \u0D9C\u0DD2\u0DAB\u0DD4\u0DB8 \u0DB1\u0DD0\u0DC0\u0DAD \u0DC3\u0D9A\u0DC3\u0DCA \u0D9A\u0DD2\u0DBB\u0DD3\u0DB8\u0DA7 \u0DC3\u0DD2\u0DAF\u0DD4\u0DC0\u0DD0.
          </WarningBox>
        </>
      ),
    },
    {
      number: 2,
      title: "\u0D94\u0DB6\u0DD0 Dashboard \u0D91\u0D9A",
      content: (
        <>
          <Paragraph>\u0DC3\u0DD0\u0DB4\u0DBA\u0DD4\u0DB8\u0DCA\u0D9A\u0DBB\u0DD4\u0DC0\u0DB1\u0DCA\u0D9C\u0DD0 Dashboard \u0D91\u0D9A\u0DD9\u0DB1\u0DCA \u0D94\u0DB6\u0DD0 \u0DC0\u0DCA\u200D\u0DBA\u0DCF\u0DB4\u0DCF\u0DBB\u0DD2\u0D9A \u0D9A\u0DA7\u0DBA\u0DD4\u0DAD\u0DD4 \u0D91\u0D9A \u0DB6\u0DD0\u0DBD\u0DCA\u0DB8\u0D9A\u0DD2\u0DB1\u0DCA \u0DB6\u0DBD\u0DCF\u0D9C\u0DB1\u0DCA\u0DB1 \u0DB4\u0DD4\u0DC5\u0DD4\u0DC0\u0DB1\u0DCA:</Paragraph>
          <BulletList
            items={[
              "\u0D94\u0DB6\u0DD0 \u0D9A\u0DCA\u200D\u0DBB\u0DD2\u0DBA\u0DCF\u0D9A\u0DCF\u0DBB\u0DD3 \u0DC3\u0DD0\u0DB4\u0DBA\u0DD4\u0DB8\u0DCA \u0DBD\u0DD0\u0DBA\u0DD2\u0DC3\u0DCA\u0DAD\u0DD4",
              "\u0D94\u0DB6\u0DD0 \u0DB1\u0DD2\u0DC2\u0DCA\u0DB4\u0DCF\u0DAF\u0DB1 \u0D9C\u0DD0\u0DB1 \u0D9C\u0DDC\u0DC0\u0DD3\u0DB1\u0DCA\u0D9C\u0DD9\u0DB1\u0DCA \u0D86\u0DB4\u0DD4 \u0D85\u0DBD\u0DD4\u0DAD\u0DCA\u0DB8 \u0DC0\u0DD2\u0DB8\u0DC3\u0DD3\u0DB8\u0DCA",
              "\u0DB1\u0DDC\u0DB6\u0DD0\u0DBD\u0DD6 \u0DB4\u0DAB\u0DD2\u0DC0\u0DD2\u0DA9 \u0DAD\u0DD2\u0DBA\u0DD9\u0DB1 \u0DB6\u0DC0 \u0DB4\u0DD9\u0DB1\u0DCA\u0DC0\u0DB1 Notification badge \u0D91\u0D9A",
            ]}
          />
        </>
      ),
    },
    {
      number: 3,
      title: "\u0DC3\u0DD0\u0DB4\u0DBA\u0DD4\u0DB8\u0DCA \u0DBD\u0DD0\u0DBA\u0DD2\u0DC3\u0DCA\u0DAD\u0DD4 \u0DB1\u0DD2\u0DBB\u0DCA\u0DB8\u0DCF\u0DAB\u0DBA \u0D9A\u0DD2\u0DBB\u0DD3\u0DB8",
      content: (
        <>
          <Paragraph>
            \u0DC3\u0DD0\u0DB4\u0DBA\u0DD4\u0DB8\u0DCA \u0DBD\u0DD0\u0DBA\u0DD2\u0DC3\u0DCA\u0DAD\u0DD4\u0DC0\u0D9A\u0DCA \u0D9A\u0DD2\u0DBA\u0DB1\u0DCA\u0DB1\u0DD0 \u0D94\u0DBA\u0DCF \u0D9C\u0DDC\u0DC0\u0DD3\u0DB1\u0DCA\u0DA7 \u0DC0\u0DD2\u0D9A\u0DD4\u0DAB\u0DB1 \u0DB1\u0DD2\u0DC2\u0DCA\u0DB4\u0DCF\u0DAF\u0DB1\u0DBA\u0D9A\u0DCA \u0D9C\u0DD0\u0DB1 \u0DAD\u0DDC\u0DBB\u0DAD\u0DD4\u0DBB\u0DD4 \u0DB4\u0DD9\u0DB1\u0DCA\u0DC0\u0DB1 \u0D91\u0D9A\u0D9A\u0DCA. \u0DB4\u0DD0\u0DC4\u0DD0\u0DAF\u0DD2\u0DBD\u0DD2 \u0DC0\u0DD2\u0DC3\u0DCA\u0DAD\u0DBB \u0DC3\u0DC4 \u0DA1\u0DCF\u0DBA\u0DCF\u0DBB\u0DD6\u0DB4 \u0DAD\u0DD2\u0DBA\u0DD9\u0DB1 \u0DC4\u0DDC\u0DB3 \u0DBD\u0DD0\u0DBA\u0DD2\u0DC3\u0DCA\u0DAD\u0DD4 \u0DC0\u0DBD\u0DA7 \u0DAD\u0DB8\u0DBA\u0DD2 \u0DC0\u0DD0\u0DA9\u0DD2\u0DB8 \u0DC0\u0DD2\u0DB8\u0DC3\u0DD3\u0DB8\u0DCA \u0DBD\u0DD0\u0DB6\u0DD9\u0DB1\u0DCA\u0DB1\u0DD0.
          </Paragraph>

          <SubHeading>3.1 \u0DBD\u0DD0\u0DBA\u0DD2\u0DC3\u0DCA\u0DAD\u0DD4\u0DC0\u0D9A\u0DCA \u0DC4\u0DAF\u0DB1 \u0DC4\u0DD0\u0DA7\u0DD2</SubHeading>
          <StepTable
            steps={[
              { step: 1, action: "\u0DBD\u0DD0\u0DBA\u0DD2\u0DC3\u0DCA\u0DAD\u0DD4 \u0DC0\u0DD9\u0DAD \u0DBA\u0DB1\u0DCA\u0DB1", details: "navigation \u0D91\u0D9A\u0DD9\u0DB1\u0DCA \u201CListings\u201D \u0DAD\u0DA7\u0DCA\u0DA7\u0DD4 \u0D9A\u0DBB\u0DB1\u0DCA\u0DB1" },
              { step: 2, action: "\u201CCreate New\u201D \u0DAD\u0DA7\u0DCA\u0DA7\u0DD4 \u0D9A\u0DBB\u0DB1\u0DCA\u0DB1", details: "\u0DBD\u0DD0\u0DBA\u0DD2\u0DC3\u0DCA\u0DAD\u0DD4 \u0DB1\u0DD2\u0DBB\u0DCA\u0DB8\u0DCF\u0DAB\u0DBA \u0D9A\u0DBB\u0DB1 form \u0D91\u0D9A \u0DC0\u0DD2\u0DC0\u0DD8\u0DAD \u0DC0\u0DD0\u0DC0\u0DD2" },
              { step: 3, action: "\u0DC0\u0DBB\u0DCA\u0D9C\u0DBA \u0DAD\u0DDD\u0DBB\u0DB1\u0DCA\u0DB1", details: "\u0DAD\u0DDD\u0DBB\u0DB1\u0DCA\u0DB1: \u0DB6\u0DD3\u0DA2, \u0DB4\u0DDC\u0DC4\u0DDC\u0DBB, \u0D9A\u0DD8\u0DB8\u0DD2\u0DB1\u0DCF\u0DC1\u0D9A, \u0DB8\u0DD9\u0DC0\u0DBD\u0DB8\u0DCA \u0DC3\u0DC4 \u0D89\u0DB4\u0D9A\u0DBB\u0DAB, \u0DC4\u0DDD \u0DC0\u0DD9\u0DB1\u0DAD\u0DCA" },
              { step: 4, action: "\u0DB1\u0DD2\u0DC2\u0DCA\u0DB4\u0DCF\u0DAF\u0DB1\u0DBA\u0DD0 \u0DB1\u0DB8 \u0D87\u0DAD\u0DD4\u0DC5\u0DAD\u0DCA \u0D9A\u0DBB\u0DB1\u0DCA\u0DB1", details: "\u0DB4\u0DD0\u0DC4\u0DD0\u0DAF\u0DD2\u0DBD\u0DD2, \u0DC0\u0DD2\u0DC3\u0DCA\u0DAD\u0DBB\u0DCF\u0DAD\u0DCA\u0DB8\u0D9A \u0DB1\u0DB8\u0D9A\u0DCA (\u0D89\u0DAF: \u201COrganic NPK Fertilizer 50kg\u201D)" },
              { step: 5, action: "\u0DB8\u0DD2\u0DBD \u0DB1\u0DD2\u0DBA\u0DB8 \u0D9A\u0DBB\u0DB1\u0DCA\u0DB1", details: "\u0DC1\u0DCA\u200D\u0DBB\u0DD3 \u0DBD\u0D82\u0D9A\u0DCF \u0DBB\u0DD4\u0DB4\u0DD2\u0DBA\u0DBD\u0DCA (LKR) \u0DC0\u0DBD\u0DD2\u0DB1\u0DCA \u0DB8\u0DD2\u0DBD. \u0D92\u0D9A\u0D9A\u0DBA\u0D9A\u0DA7, kg \u0D91\u0D9A\u0D9A\u0DA7, \u0DC4\u0DDD \u0DB6\u0DD1\u0D9C\u0DBA\u0D9A\u0DA7\u0DAF \u0D9A\u0DD2\u0DBA\u0DCF \u0DC3\u0DB3\u0DC4\u0DB1\u0DCA \u0D9A\u0DBB\u0DB1\u0DCA\u0DB1" },
              { step: 6, action: "\u0DC0\u0DD2\u0DC3\u0DCA\u0DAD\u0DBB\u0DBA \u0D87\u0DAD\u0DD4\u0DC5\u0DAD\u0DCA \u0D9A\u0DBB\u0DB1\u0DCA\u0DB1", details: "\u0DC3\u0DC0\u0DD2\u0DC3\u0DCA\u0DAD\u0DBB\u0DCF\u0DAD\u0DCA\u0DB8\u0D9A \u0DB1\u0DD2\u0DC2\u0DCA\u0DB4\u0DCF\u0DAF\u0DB1 \u0DAD\u0DDC\u0DBB\u0DAD\u0DD4\u0DBB\u0DD4: \u0DC3\u0D82\u0DBA\u0DD4\u0DAD\u0DD2\u0DBA, \u0DB7\u0DCF\u0DC0\u0DD2\u0DAD \u0D89\u0DB4\u0DAF\u0DD9\u0DC3\u0DCA, \u0DC0\u0DD9\u0DC5\u0DB3 \u0DB1\u0DCF\u0DB8\u0DBA, \u0D87\u0DC3\u0DD4\u0DBB\u0DD4\u0DB8\u0DCA \u0DB4\u0DCA\u200D\u0DBB\u0DB8\u0DCF\u0DAB\u0DBA" },
              { step: 7, action: "\u0DBD\u0DB6\u0DCF \u0D9C\u0DAD \u0DC4\u0DD0\u0D9A\u0DD2 \u0DB6\u0DC0 \u0DC3\u0D9A\u0DC3\u0DB1\u0DCA\u0DB1", details: "\u0DB1\u0DD2\u0DC2\u0DCA\u0DB4\u0DCF\u0DAF\u0DB1\u0DBA \u0DAD\u0DDC\u0D9C\u0DBA\u0DD0 \u0DAD\u0DD2\u0DB6\u0DD0\u0DAF, \u0DB6\u0DD9\u0DAF\u0DCF\u0DC4\u0DD0\u0DBB\u0DD3\u0DB8\u0DD0 \u0DB4\u0DCA\u200D\u0DBB\u0DAF\u0DD0\u0DC1\u0DBA, \u0D85\u0DC0\u0DB8 \u0D87\u0DAB\u0DC0\u0DD4\u0DB8\u0DCA \u0DB4\u0DCA\u200D\u0DBB\u0DB8\u0DCF\u0DAB\u0DBA" },
              { step: 8, action: "\u0DA1\u0DCF\u0DBA\u0DCF\u0DBB\u0DD6\u0DB4 \u0D89\u0DA9\u0DD4\u0D9C\u0DAD \u0D9A\u0DBB\u0DB1\u0DCA\u0DB1", details: "\u0DB4\u0DD0\u0DC4\u0DD0\u0DAF\u0DD2\u0DBD\u0DD2 \u0DB1\u0DD2\u0DC2\u0DCA\u0DB4\u0DCF\u0DAF\u0DB1 \u0DA1\u0DCF\u0DBA\u0DCF\u0DBB\u0DD6\u0DB4. \u0DC0\u0DD2\u0DC0\u0DD2\u0DB0 \u0D9A\u0DDD\u0DAB \u0DC0\u0DBD\u0DD2\u0DB1\u0DCA \u0D9C\u0DAD\u0DCA \u0DA1\u0DCF\u0DBA\u0DCF\u0DBB\u0DD6\u0DB4 \u0D9C\u0DDC\u0DC0\u0DD3\u0DB1\u0DCA\u0DA7 \u0DAD\u0DD3\u0DBB\u0DAB \u0D9C\u0DD0\u0DB1\u0DD3\u0DB8\u0DA7 \u0D89\u0DB4\u0D9A\u0DCF\u0DBB\u0DD3 \u0DC0\u0DD0" },
              { step: 9, action: "\u0D89\u0DAF\u0DD2\u0DBB\u0DD2\u0DB4\u0DAD\u0DCA \u0D9A\u0DBB\u0DB1\u0DCA\u0DB1", details: "\u0D94\u0DB6\u0DD0 \u0DBD\u0DD0\u0DBA\u0DD2\u0DC3\u0DCA\u0DAD\u0DD4\u0DC0 \u0DC3\u0DD0\u0DB4\u0DBA\u0DD4\u0DB8\u0DCA \u0DC0\u0DD9\u0DC5\u0DB3\u0DB4\u0DDC\u0DC5\u0DD0 \u0DB4\u0DCA\u200D\u0DBB\u0DAF\u0DBB\u0DCA\u0DC1\u0DB1\u0DBA \u0DC0\u0DD0" },
            ]}
          />

          <SubHeading>3.2 \u0D94\u0DB6\u0DD0 \u0DBD\u0DD0\u0DBA\u0DD2\u0DC3\u0DCA\u0DAD\u0DD4 \u0D9A\u0DC5\u0DB8\u0DB1\u0DCF\u0D9A\u0DBB\u0DAB\u0DBA \u0D9A\u0DD2\u0DBB\u0DD3\u0DB8</SubHeading>
          <BulletList
            items={[
              "\u0DC3\u0D82\u0DC3\u0DCA\u0D9A\u0DBB\u0DAB\u0DBA \u0D9A\u0DBB\u0DB1\u0DCA\u0DB1 \u2014 \u0D95\u0DB1\u0DD0\u0DB8 \u0DC0\u0DD9\u0DBD\u0DCF\u0DC0\u0D9A \u0DB8\u0DD2\u0DBD, \u0DC0\u0DD2\u0DC3\u0DCA\u0DAD\u0DBB\u0DBA, \u0DBD\u0DB6\u0DCF \u0D9C\u0DAD \u0DC4\u0DD0\u0D9A\u0DD2 \u0DB6\u0DC0 \u0DC4\u0DDD \u0DA1\u0DCF\u0DBA\u0DCF\u0DBB\u0DD6\u0DB4 \u0DBA\u0DCF\u0DC0\u0DAD\u0DCA\u0D9A\u0DCF\u0DBD\u0DD3\u0DB1 \u0D9A\u0DBB\u0DB1\u0DCA\u0DB1",
              "\u0DB8\u0D9A\u0DB1\u0DCA\u0DB1 \u2014 \u0D94\u0DBA\u0DCF \u0DAD\u0DC0\u0DAF\u0DD4\u0DBB\u0DA7\u0DAD\u0DCA \u0DC0\u0DD2\u0D9A\u0DD4\u0DAB\u0DB1\u0DCA\u0DB1\u0DD0 \u0DB1\u0DD0\u0DAD\u0DD2 \u0DB1\u0DD2\u0DC2\u0DCA\u0DB4\u0DCF\u0DAF\u0DB1 \u0D89\u0DC0\u0DAD\u0DCA \u0D9A\u0DBB\u0DB1\u0DCA\u0DB1",
            ]}
          />
          <TipBox>
            <strong>\u0DBD\u0DD0\u0DBA\u0DD2\u0DC3\u0DCA\u0DAD\u0DD4\u0D9A\u0DBB\u0DAB \u0D89\u0D9F\u0DD2:</strong> \u0D94\u0DB6\u0DD0 \u0DAD\u0DDC\u0D9C\u0DBA \u0DBA\u0DCF\u0DC0\u0DAD\u0DCA\u0D9A\u0DCF\u0DBD\u0DD3\u0DB1\u0DC0 \u0DAD\u0DB6\u0DCF \u0D9C\u0DB1\u0DCA\u0DB1 \u2014 \u0DB1\u0DD2\u0DC2\u0DCA\u0DB4\u0DCF\u0DAF\u0DB1 \u0DB1\u0DDC\u0DB8\u0DD0\u0DAD\u0DD2 \u0DC0\u0DD2\u0DA7 \u0D92\u0DC0\u0DCF \u0D89\u0DC0\u0DAD\u0DCA \u0D9A\u0DBB\u0DB1\u0DCA\u0DB1 \u0DC4\u0DDD \u0DAD\u0DDC\u0D9C\u0DBA\u0DD9\u0DB1\u0DCA \u0DB4\u0DD2\u0DA7\u0DAD \u0DBD\u0DD9\u0DC3 \u0DC3\u0DBD\u0D9A\u0DD4\u0DAB\u0DD4 \u0D9A\u0DBB\u0DB1\u0DCA\u0DB1. \u0DBA\u0DBD\u0DCA \u0DB4\u0DD0\u0DB1 \u0D9C\u0DD2\u0DBA \u0DBD\u0DD0\u0DBA\u0DD2\u0DC3\u0DCA\u0DAD\u0DD4 \u0DC3\u0DC4\u0DD2\u0DAD \u0DC3\u0DD0\u0DB4\u0DBA\u0DD4\u0DB8\u0DCA\u0D9A\u0DBB\u0DD4\u0DC0\u0DB1\u0DCA \u0D9A\u0DD9\u0DBB\u0DD9\u0DC4\u0DD2 \u0D9C\u0DDC\u0DC0\u0DD3\u0DB1\u0DCA\u0D9C\u0DD0 \u0DC0\u0DD2\u0DC1\u0DCA\u0DC0\u0DCF\u0DC3\u0DBA \u0DB1\u0DD0\u0DAD\u0DD2 \u0DC0\u0DD9\u0DB1\u0DC0\u0DCF. \u0D87\u0DC3\u0DD4\u0DBB\u0DD4\u0DB8\u0DCA \u0DB4\u0DCA\u200D\u0DBB\u0DB8\u0DCF\u0DAB\u0DBA\u0DB1\u0DCA \u0DC3\u0DC4 \u0DB8\u0DD2\u0DBD \u0D9C\u0DAB\u0DB1\u0DCA \u0DB4\u0DD0\u0DC4\u0DD0\u0DAF\u0DD2\u0DBD\u0DD2\u0DC0 \u0D87\u0DAD\u0DD4\u0DC5\u0DAD\u0DCA \u0D9A\u0DBB\u0DB1\u0DCA\u0DB1.
          </TipBox>
        </>
      ),
    },
    {
      number: 4,
      title: "\u0D9C\u0DDC\u0DC0\u0DD2 \u0DC0\u0DD2\u0DB8\u0DC3\u0DD3\u0DB8\u0DCA \u0D9A\u0DC5\u0DB8\u0DB1\u0DCF\u0D9A\u0DBB\u0DAB\u0DBA \u0D9A\u0DD2\u0DBB\u0DD3\u0DB8",
      content: (
        <>
          <Paragraph>\u0D9C\u0DDC\u0DC0\u0DD2\u0DBA\u0DD9\u0D9A\u0DCA \u0D94\u0DBA\u0DCF\u0D9C\u0DD0 \u0DB7\u0DCF\u0DAB\u0DCA\u0DA9\u0DBA\u0D9A\u0DCA \u0D9C\u0DD0\u0DB1 \u0D89\u0DB1\u0DB1\u0DCA\u0DAF\u0DD4 \u0DC0\u0DD4\u0DAB\u0DCF\u0DB8, \u0D91\u0DBA\u0DCF\u0DBD\u0DCF \u0D87\u0DB4\u0DCA \u0D91\u0D9A \u0DC4\u0DBB\u0DC4\u0DCF \u0DC0\u0DD2\u0DB8\u0DC3\u0DD3\u0DB8\u0D9A\u0DCA \u0DBA\u0DC0\u0DB1\u0DC0\u0DCF.</Paragraph>
          <StepTable
            steps={[
              { step: 1, action: "\u0DC0\u0DD2\u0DB8\u0DC3\u0DD3\u0DB8\u0DCA \u0DC0\u0DBD\u0DA7 \u0DBA\u0DB1\u0DCA\u0DB1", details: "navigation \u0D91\u0D9A\u0DD9\u0DB1\u0DCA \u201CInquiries\u201D \u0D9A\u0DD2\u0DBA\u0DB1 \u0D91\u0D9A \u0DAD\u0DA7\u0DCA\u0DA7\u0DD4 \u0D9A\u0DBB\u0DB1\u0DCA\u0DB1" },
              { step: 2, action: "\u0DC0\u0DD2\u0DB8\u0DC3\u0DD3\u0DB8 \u0DB6\u0DBD\u0DB1\u0DCA\u0DB1", details: "\u0D9C\u0DDC\u0DC0\u0DD2\u0DBA\u0DCF\u0D9C\u0DD0 \u0DB1\u0DB8, \u0D89\u0DB1\u0DCA\u0DB1 \u0DAD\u0DD0\u0DB1, \u0D91\u0DBA\u0DCF\u0DBD\u0DCF \u0D85\u0DC4\u0DB1 \u0DB7\u0DCF\u0DAB\u0DCA\u0DA9\u0DBA \u0DC3\u0DC4 \u0D91\u0DBA\u0DCF\u0DBD\u0D9C\u0DD0 \u0DB4\u0DAB\u0DD2\u0DC0\u0DD2\u0DA9\u0DBA \u0DB6\u0DBD\u0DB1\u0DCA\u0DB1" },
              { step: 3, action: "\u0DB4\u0DD2\u0DC5\u0DD2\u0DAD\u0DD4\u0DBB\u0DD4 \u0DAF\u0DD9\u0DB1\u0DCA\u0DB1", details: "\u0DB7\u0DCF\u0DAB\u0DCA\u0DA9 \u0DAD\u0DD2\u0DBA\u0DD9\u0DB1\u0DC0\u0DAF, \u0DB8\u0DD2\u0DBD \u0D9C\u0DAB\u0DB1\u0DCA, \u0DB6\u0DD9\u0DAF\u0DCF\u0DC4\u0DD0\u0DBB\u0DD3\u0DB8\u0DD0 \u0D9A\u0DCA\u200D\u0DBB\u0DB8, \u0DB1\u0DD0\u0DAD\u0DCA\u0DB1\u0DB8\u0DCA \u0DC0\u0DD9\u0DB1\u0DAD\u0DCA \u0D95\u0DB1\u0DD0\u0DB8 \u0DC0\u0DD2\u0DC3\u0DCA\u0DAD\u0DBB\u0DBA\u0D9A\u0DCA \u0D91\u0D9A\u0DCA\u0D9A \u0DB4\u0DD2\u0DC5\u0DD2\u0DAD\u0DD4\u0DBB\u0DD4 \u0DAF\u0DD9\u0DB1\u0DCA\u0DB1" },
            ]}
          />
          <TipBox>
            <strong>\u0D89\u0D9A\u0DCA\u0DB8\u0DB1\u0DCA \u0DB4\u0DCA\u200D\u0DBB\u0DAD\u0DD2\u0DA0\u0DCF\u0DBB \u0DC0\u0DD0\u0DAF\u0D9C\u0DAD\u0DCA:</strong> \u0D9C\u0DDC\u0DC0\u0DD3\u0DB1\u0DCA\u0DA7 \u0D9C\u0DDC\u0DA9\u0D9A\u0DCA \u0DC0\u0DD9\u0DBD\u0DCF\u0DC0\u0DA7 \u0D89\u0D9A\u0DCA\u0DB8\u0DB1\u0DA7 \u0DB6\u0DA9\u0DD4 \u0D95\u0DB1 \u0DC0\u0DD9\u0DB1\u0DC0\u0DCF. \u0D89\u0D9A\u0DCA\u0DB8\u0DB1\u0DCA \u0DB4\u0DCA\u200D\u0DBB\u0DAD\u0DD2\u0DA0\u0DCF\u0DBB \u0DB1\u0DD2\u0DC3\u0DCF \u0D94\u0DBA\u0DCF\u0D9C\u0DD0 \u0DC4\u0DDC\u0DB3 \u0DB1\u0DB8 \u0DC4\u0DD0\u0DAF\u0DD9\u0DB1\u0DC0\u0DCF \u0DC0\u0D9C\u0DD0\u0DB8, \u0D86\u0DBA\u0DD9\u0DAD\u0DCA \u0D91\u0DBA\u0DCF\u0DBD\u0DCF \u0D94\u0DBA\u0DCF\u0D9C\u0DD9\u0DB1\u0DCA \u0DB6\u0DA9\u0DD4 \u0D9C\u0DB1\u0DCA\u0DB1 \u0D91\u0DB1\u0DC0\u0DCF.
          </TipBox>
        </>
      ),
    },
    {
      number: 5,
      title: "\u0DAF\u0DD0\u0DB1\u0DD4\u0DB8\u0DCA\u0DAF\u0DD3\u0DB8\u0DCA",
      content: (
        <>
          <Paragraph>GoviHub \u0D94\u0DB6\u0DA7 \u0DAF\u0DD0\u0DB1\u0DD4\u0DB8\u0DCA\u0DAF\u0DD3\u0DB8\u0DCA \u0D91\u0DC0\u0DB1\u0DCA\u0DB1\u0DD0 \u0DB8\u0DD0 \u0DAF\u0DD0\u0DC0\u0DBD\u0DCA \u0DC3\u0DB3\u0DC4\u0DCF\u0DBA\u0DD2:</Paragraph>
          <BulletList
            items={[
              "\u0D94\u0DB6\u0DD0 \u0DB1\u0DD2\u0DC2\u0DCA\u0DB4\u0DCF\u0DAF\u0DB1 \u0D9C\u0DD0\u0DB1 \u0D9C\u0DDC\u0DC0\u0DD3\u0DB1\u0DCA\u0D9C\u0DD9\u0DB1\u0DCA \u0D91\u0DB1 \u0D85\u0DBD\u0DD4\u0DAD\u0DCA \u0DC0\u0DD2\u0DB8\u0DC3\u0DD3\u0DB8\u0DCA",
              "GoviHub \u0DB4\u0DBB\u0DD2\u0DB4\u0DCF\u0DBD\u0D9A\u0DBA\u0DD2\u0DB1\u0DCA\u0D9C\u0DD9\u0DB1\u0DCA \u0D91\u0DB1 \u0DC0\u0DD0\u0DAF\u0DD2\u0D9A\u0DCF \u0DB1\u0DD2\u0DC0\u0DD0\u0DAF\u0DB1",
            ]}
          />
          <Paragraph>
            \u0D94\u0DB6\u0DD0 Dashboard \u0D91\u0D9A\u0DD0 \u0DAD\u0DD2\u0DBA\u0DD9\u0DB1 notification bell \u0D91\u0D9A\u0DD9\u0DB1\u0DCA \u0D9A\u0DD2\u0DBA\u0DC0\u0DB4\u0DD4 \u0DB1\u0DD0\u0DAD\u0DD2 \u0DAF\u0DD0\u0DB1\u0DD4\u0DB8\u0DCA\u0DAF\u0DD3\u0DB8\u0DCA \u0DB4\u0DD9\u0DB1\u0DCA\u0DC0\u0DB1\u0DC0\u0DCF. \u0D92\u0D9A touch \u0D9A\u0DBB\u0DBD\u0DCF \u0DC4\u0DD0\u0DB8 \u0D91\u0D9A\u0D9A\u0DCA\u0DB8 \u0DB6\u0DBD\u0DB1\u0DCA\u0DB1 \u0DB4\u0DD4\u0DC5\u0DD4\u0DC0\u0DB1\u0DCA, \u0D92 \u0DC0\u0D9C\u0DD0\u0DB8 \u0D91\u0D9A\u0DD2\u0DB1\u0DCA \u0D91\u0D9A \u0DC4\u0DDD \u0D91\u0D9A\u0DC0\u0DBB\u0DB8 \u0D9A\u0DD2\u0DBA\u0DD9\u0DC0\u0DCA\u0DC0\u0DCF \u0D9A\u0DD2\u0DBA\u0DBD\u0DCF \u0DC3\u0DBD\u0D9A\u0DD4\u0DAB\u0DD4 \u0D9A\u0DBB\u0DB1\u0DCA\u0DB1\u0DAD\u0DCA \u0DB4\u0DD4\u0DC5\u0DD4\u0DC0\u0DB1\u0DCA.
          </Paragraph>
        </>
      ),
    },
    {
      number: 6,
      title: "\u0DC3\u0DD0\u0D9A\u0DC3\u0DD4\u0DB8\u0DCA \u0DC3\u0DC4 \u0DB4\u0DD0\u0DAD\u0DD2\u0D9A\u0DA9",
      content: (
        <>
          <SubHeading>6.1 \u0DB4\u0DD0\u0DAD\u0DD2\u0D9A\u0DA9 \u0DC3\u0DD0\u0D9A\u0DC3\u0DD4\u0DB8\u0DCA</SubHeading>
          <Paragraph>
            \u0D94\u0DB6\u0DD0 \u0DC0\u0DCA\u200D\u0DBA\u0DCF\u0DB4\u0DCF\u0DBB \u0DAD\u0DDC\u0DBB\u0DAD\u0DD4\u0DBB\u0DD4, \u0D91\u0DB1\u0DB8\u0DCA \u0DC0\u0DCA\u200D\u0DBA\u0DCF\u0DB4\u0DCF\u0DBB\u0DBA\u0DD0 \u0DB1\u0DB8, \u0DAF\u0DD4\u0DBB\u0D9A\u0DAD\u0DB1 \u0D85\u0D82\u0D9A\u0DBA, \u0DAF\u0DD2\u0DC3\u0DCA\u0DAD\u0DCA\u200D\u0DBB\u0DD2\u0D9A\u0DCA\u0D9A\u0DBA, \u0DB1\u0DD2\u0DC2\u0DCA\u0DB4\u0DCF\u0DAF\u0DB1 \u0DC0\u0DBB\u0DCA\u0D9C \u0DC3\u0DC4 \u0DC3\u0DD0\u0DC0\u0DCF \u0DC3\u0DB4\u0DBA\u0DB1 \u0DB4\u0DCA\u200D\u0DBB\u0DAF\u0DD0\u0DC1\u0DBA \u0DBA\u0DCF\u0DC0\u0DAD\u0DCA\u0D9A\u0DCF\u0DBD\u0DD3\u0DB1 \u0D9A\u0DBB\u0DB1\u0DCA\u0DB1.
          </Paragraph>
          <SubHeading>6.2 \u0DAF\u0DD0\u0DB1\u0DD4\u0DB8\u0DCA\u0DAF\u0DD3\u0DB8\u0DCA \u0DB8\u0DB1\u0DCF\u0DB4</SubHeading>
          <Paragraph>\u0D94\u0DB6\u0DA7 \u0DBD\u0DD0\u0DB6\u0DD2\u0DBA \u0DBA\u0DD4\u0DAD\u0DD4 \u0DAF\u0DD0\u0DB1\u0DD4\u0DB8\u0DCA\u0DAF\u0DD3\u0DB8\u0DCA \u0DB8\u0DDC\u0DB1\u0DC0\u0DCF\u0DAF\u0DD0\u0DBA\u0DD2 \u0DB4\u0DCF\u0DBD\u0DB1\u0DBA \u0D9A\u0DBB\u0DB1\u0DCA\u0DB1.</Paragraph>
          <SubHeading>6.3 \u0DB8\u0DD4\u0DBB\u0DB4\u0DAF\u0DBA \u0DC0\u0DD9\u0DB1\u0DC3\u0DCA \u0D9A\u0DBB\u0DB1\u0DCA\u0DB1</SubHeading>
          <Paragraph>
            \u0DC3\u0DD0\u0D9A\u0DC3\u0DD4\u0DB8\u0DCA &gt; \u0DB8\u0DD4\u0DBB\u0DB4\u0DAF\u0DBA \u0DC0\u0DD9\u0DB1\u0DC3\u0DCA \u0D9A\u0DBB\u0DB1\u0DCA\u0DB1 \u0DC0\u0DD9\u0DAD \u0DBA\u0DB1\u0DCA\u0DB1. \u0D85\u0DBD\u0DD4\u0DAD\u0DCA \u0DB8\u0DD4\u0DBB\u0DB4\u0DAF\u0DBA\u0D9A\u0DCA \u0DC3\u0D9A\u0DC3\u0DCA \u0D9A\u0DBB\u0DB1\u0DCA\u0DB1 \u0D94\u0DB6\u0DA7 \u0DAF\u0DD0\u0DB1\u0DA7\u0DDC \u0DB4\u0DC0\u0DAD\u0DD2\u0DB1 \u0DB8\u0DD4\u0DBB\u0DB4\u0DAF\u0DBA \u0D85\u0DC0\u0DC1\u0DCA\u200D\u0DBA \u0DC0\u0DD0.
          </Paragraph>
        </>
      ),
    },
    {
      number: 7,
      title: "\u0DB4\u0DCA\u200D\u0DBB\u0DAD\u0DD2\u0DA0\u0DCF\u0DBB \u0DBD\u0DB6\u0DCF\u0DAF\u0DD3\u0DB8",
      content: (
        <>
          <Paragraph>
            GoviHub \u0DAD\u0DC0\u0DAD\u0DCA \u0DC4\u0DDC\u0DB3 \u0D9A\u0DBB\u0DB1\u0DCA\u0DB1 \u0D85\u0DB4\u0DD2\u0DA7 \u0D89\u0DAF\u0DC0\u0DCA \u0D9A\u0DBB\u0DB1\u0DCA\u0DB1! More \u0DB8\u0DD9\u0DB1\u0DD4\u0DC0\u0DA7 \u0D9C\u0DD2\u0DC4\u0DD2\u0DB1\u0DCA &quot;Feedback&quot; \u0D91\u0D9A \u0DAD\u0DA7\u0DCA\u0DA7\u0DD4 \u0D9A\u0DBB\u0DBD\u0DCF \u0D94\u0DB6\u0DD0 \u0D85\u0DAF\u0DC4\u0DC3\u0DCA \u0D9A\u0DD2\u0DBA\u0DB1\u0DCA\u0DB1, \u0D9C\u0DD0\u0DA7\u0DBD\u0DD4 \u0DC0\u0DCF\u0DBB\u0DCA\u0DAD\u0DCF \u0D9A\u0DBB\u0DB1\u0DCA\u0DB1, \u0DB1\u0DD0\u0DAD\u0DCA\u0DB1\u0DB8\u0DCA \u0D85\u0DBD\u0DD4\u0DAD\u0DCA \u0DAF\u0DD0\u0DC0\u0DBD\u0DCA \u0DBA\u0DDD\u0DA2\u0DB1\u0DCF \u0D9A\u0DBB\u0DB1\u0DCA\u0DB1.
          </Paragraph>
        </>
      ),
    },
    {
      number: 8,
      title: "\u0D89\u0D9A\u0DCA\u0DB8\u0DB1\u0DCA \u0DC0\u0DD2\u0DB8\u0DC3\u0DD4\u0DB8\u0DCA",
      content: (
        <>
          <QuickRefTable
            headers={{ want: "\u0DB8\u0DA7 \u0D95\u0DB1 \u0DB1\u0DB8\u0DCA...", goto: "\u0DBA\u0DB1\u0DCA\u0DB1..." }}
            rows={[
              { want: "\u0DB7\u0DCF\u0DAB\u0DCA\u0DA9\u0DBA\u0D9A\u0DCA \u0DC0\u0DD2\u0D9A\u0DD2\u0DAB\u0DD3\u0DB8\u0DA7 \u0DBD\u0DD0\u0DBA\u0DD2\u0DC3\u0DCA\u0DAD\u0DD4\u0D9C\u0DAD \u0D9A\u0DBB\u0DB1\u0DCA\u0DB1", goto: "Listings > Create New" },
              { want: "\u0D9C\u0DDC\u0DC0\u0DD3\u0DB1\u0DCA\u0D9C\u0DD0 \u0DC0\u0DD2\u0DB8\u0DC3\u0DD3\u0DB8\u0DCA \u0DB6\u0DBD\u0DB1\u0DCA\u0DB1", goto: "Inquiries (\u0DB1\u0DD0\u0DC0\u0DD2\u0D9C\u0DD0\u0DC2\u0DB1\u0DCA \u0D91\u0D9A\u0DD0)" },
              { want: "\u0DB8\u0D9C\u0DD0 \u0DBD\u0DD0\u0DBA\u0DD2\u0DC3\u0DCA\u0DAD\u0DD4 \u0DBA\u0DCF\u0DC0\u0DAD\u0DCA\u0D9A\u0DCF\u0DBD\u0DD3\u0DB1 \u0D9A\u0DBB\u0DB1\u0DCA\u0DB1", goto: "Listings > \u0D95\u0DB1\u0DD0\u0DB8 \u0DBD\u0DD0\u0DBA\u0DD2\u0DC3\u0DCA\u0DAD\u0DD4\u0DC0\u0D9A\u0DCA \u0DC3\u0D82\u0DC3\u0DCA\u0D9A\u0DBB\u0DAB\u0DBA \u0D9A\u0DD2\u0DBB\u0DD3\u0DB8\u0DA7 \u0DAD\u0DA7\u0DCA\u0DA7\u0DD4 \u0D9A\u0DBB\u0DB1\u0DCA\u0DB1" },
              { want: "\u0DB8\u0D9C\u0DD0 \u0DAF\u0DD0\u0DB1\u0DD4\u0DB8\u0DCA\u0DAF\u0DD3\u0DB8\u0DCA \u0DB6\u0DBD\u0DB1\u0DCA\u0DB1", goto: "Dashboard \u0D91\u0D9A\u0DD0 Notification bell \u0D91\u0D9A" },
              { want: "\u0DB8\u0D9C\u0DD0 \u0DB4\u0DD0\u0DAD\u0DD2\u0D9A\u0DA9 \u0DBA\u0DCF\u0DC0\u0DAD\u0DCA\u0D9A\u0DCF\u0DBD\u0DD3\u0DB1 \u0D9A\u0DBB\u0DB1\u0DCA\u0DB1", goto: "Settings" },
              { want: "\u0DB8\u0D9C\u0DD0 \u0DB8\u0DD4\u0DBB\u0DB4\u0DAF\u0DBA \u0DC0\u0DD9\u0DB1\u0DC3\u0DCA \u0D9A\u0DBB\u0DB1\u0DCA\u0DB1", goto: "Settings > Change Password" },
              { want: "\u0DB4\u0DCA\u200D\u0DBB\u0DAD\u0DD2\u0DA0\u0DCF\u0DBB \u0DAF\u0D9A\u0DCA\u0DC0\u0DB1\u0DCA\u0DB1", goto: "More > Feedback" },
            ]}
          />
        </>
      ),
    },
  ],
  help: {
    title: "\u0D89\u0DAF\u0DC0\u0DCA \u0D85\u0DC0\u0DC1\u0DCA\u200D\u0DBA\u0DAF?",
    items: [
      "\u0D87\u0DB4\u0DCA \u0D91\u0D9A \u0DC4\u0DBB\u0DC4\u0DCF \u0DB4\u0DCA\u200D\u0DBB\u0DAD\u0DD2\u0DA0\u0DCF\u0DBB \u0D89\u0DAF\u0DD2\u0DBB\u0DD2\u0DB4\u0DAD\u0DCA \u0D9A\u0DBB\u0DB1\u0DCA\u0DB1 (More > Feedback)",
      "\u0D94\u0DB6\u0DD0 \u0DB4\u0DCA\u200D\u0DBB\u0DCF\u0DAF\u0DD0\u0DC1\u0DD3\u0DBA GoviHub \u0DC3\u0DB8\u0DCA\u0DB6\u0DB1\u0DCA\u0DB0\u0DD3\u0D9A\u0DCF\u0DBB\u0D9A\u0DC0 \u0DC3\u0DB8\u0DCA\u0DB6\u0DB1\u0DCA\u0DB0 \u0D9A\u0DBB\u0D9C\u0DB1\u0DCA\u0DB1",
      "\u0D85\u0DB4\u0DD0 YouTube \u0DA0\u0DD0\u0DB1\u0DBD\u0DBA\u0DA7 \u0DB4\u0DD2\u0DC0\u0DD2\u0DC3\u0DD9\u0DB1\u0DCA\u0DB1: @GoviHubSriLanka",
    ],
  },
};

/* ------------------------------------------------------------------ */
/*  Page                                                                */
/* ------------------------------------------------------------------ */

export default function SupplierGuidePage() {
  const { locale } = useParams();
  const [lang, setLang] = useState<string>((locale as string) || "en");
  const guide = lang === "si" ? si : en;

  return (
    <div className="min-h-screen bg-gray-50 print:bg-white">
      {/* Header */}
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

      {/* Title Banner */}
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

      {/* Body */}
      <main className="max-w-[720px] mx-auto px-4 py-8 print:py-4">
        {guide.sections.map((section) => (
          <section
            key={section.number}
            className="print:break-inside-avoid-page"
          >
            <SectionHeading number={section.number} title={section.title} />
            {section.content}
            {section.number < 8 && (
              <hr className="my-8 border-gray-200 print:my-4" />
            )}
          </section>
        ))}

        {/* Need Help */}
        <div className="mt-12 p-6 bg-green-50 rounded-xl border border-green-200 print:break-inside-avoid">
          <h3 className="text-lg font-bold text-[#2D6A2E] mb-3">
            {guide.help.title}
          </h3>
          <BulletList items={guide.help.items} />
        </div>

        {/* YouTube Banner */}
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

        {/* CTA */}
        <div className="mt-10 mb-8 text-center print:hidden">
          <Link
            href={`/${locale || "en"}/auth/beta-login`}
            className="inline-block px-8 py-3 rounded-full bg-[#2D6A2E] text-white font-bold text-lg hover:bg-green-800 transition shadow-lg hover:shadow-xl"
          >
            {guide.meta.ctaButton}
          </Link>
        </div>

        {/* Footer */}
        <footer className="mt-12 pt-6 border-t border-gray-200 text-center text-xs text-gray-500 pb-8">
          <p className="italic">{guide.meta.footer}</p>
          <p className="mt-1">{guide.meta.footerOrg}</p>
        </footer>
      </main>
    </div>
  );
}
