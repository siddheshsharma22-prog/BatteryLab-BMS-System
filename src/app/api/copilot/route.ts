import { NextRequest, NextResponse } from "next/server";
import ZAI from "z-ai-web-dev-sdk";

export const maxDuration = 60;

const SYSTEM_PROMPT = `You are VoltAI, the real-time engineering copilot embedded in BatteryLab — a battery design & testing web app.
You see the user's live state: the cell design (chemistry, capacity, voltage window, R0, thermal data), the pack configuration (series/parallel and targets), simulation parameters, and the latest test result with its safety checks.

Your job:
1. Answer as a concise, practical battery engineer. Use the user's actual numbers in calculations (pack voltage = S × V_cell, capacity = P × Ah, energy = V × Ah, heat = I²R0...).
2. Give concrete recommendations: cell choice, S/P sizing, C-rates, cooling strategy, test profiles, and interpretation of results.
3. Flag safety issues (overtemp, exceeding C-rates, charging below 0°C, thermal runaway onset ~130°C).

IMPORTANT — actionable output: when the user asks you to pick/change something concrete (a cell, values, or S×P), END your reply with a fenced json block BatteryLab can apply automatically:
\`\`\`json
{"__apply": {"design": {...only fields to change...}, "pack": {"series": <int>, "parallel": <int>}}}
\`\`\`
Allowed design keys: name, brand, model, chemistry (NMC|LFP|LTO|LCO|NCA|LeadAcid|NiMH|NiCd), formFactor, cathode, anode, separator, electrolyte, application, capacityAh, nominalV, vmax, vmin, r0 (Ohm!), r1, c1, r2, c2, maxDischargeC, maxPulseDischargeC, maxChargeC, stdChargeC, diameterMm, lengthMm, widthMm, heightMm, thicknessMm, massKg, cpJkgK, areaM2, entropicVperK, cycleLifeCycles, cycleLifeNote, chargeTempMinC, chargeTempMaxC, dischargeTempMinC, dischargeTempMaxC, selfDischargePctMonth.
Only include fields you are confident about. Keep the prose BEFORE the json block short (max ~120 words), practical, no markdown headers.`;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const messages = Array.isArray(body.messages) ? body.messages : [];
    const context = body.context ?? {};

    if (messages.length === 0) {
      return NextResponse.json({ error: "messages are required" }, { status: 400 });
    }

    const contextStr = JSON.stringify(context, null, 1).slice(0, 6000);

    const zai = await ZAI.create();
    const completion = await zai.chat.completions.create({
      messages: [
        { role: "assistant", content: SYSTEM_PROMPT },
        {
          role: "assistant",
          content: `Current user state in BatteryLab:\n${contextStr}`,
        },
        ...messages.slice(-10).map((m: { role: string; content: string }) => ({
          role: m.role === "user" ? "user" : "user",
          content: String(m.content ?? "").slice(0, 4000),
        })),
      ],
      thinking: { type: "disabled" },
    });

    const reply = completion.choices[0]?.message?.content ?? "";
    if (!reply.trim()) {
      return NextResponse.json({ reply: "I could not generate a response — please rephrase and try again." });
    }
    return NextResponse.json({ reply });
  } catch (e) {
    console.error("POST /api/copilot failed", e);
    return NextResponse.json(
      { reply: "The AI service hit an error. Please try again in a moment." },
      { status: 200 }
    );
  }
}
