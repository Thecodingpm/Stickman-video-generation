import { fetch } from "undici"; // Node standard fetch support or global fetch fallback

const systemPrompt = `
You are a master Vector Stylus Engineer for high-fidelity whiteboard animation systems.
Your job is to optimize and refine a messy, solid-filled, or complex outline-filled SVG representation into a beautiful, single-stroke, centerline drawing sequence.

Whiteboard drawing hands cannot sketch filled solid blocks or thick dual-boundary outline shapes cleanly. They need clean, single-line stroked vector paths.

Instructions:
1. Inspect the input SVG structure.
2. Translate solid polygons, fat filled circles, and thick outline paths into elegant, single-stroke centerlines (skeleton paths). For example, replace a thick filled arrow polygon with a single centerline arrow path.
3. Ensure every path has fill="none" or fill="transparent" and a standard strokeColor and strokeWidth set.
4. Sort and order the paths sequentially so they draw naturally (outline borders first, inner details second, flowing organically).
5. Return ONLY a valid JSON object holding the optimized SVG string under the key "optimizedSvg".

Output JSON format:
{
  "optimizedSvg": "<svg>...</svg>"
}
`;

export async function refineSvgWithAi(
  rawSvg: string,
  apiKey?: string
): Promise<{ optimizedSvg: string }> {
  const geminiKey = apiKey || process.env.GEMINI_API_KEY || "";
  if (!geminiKey) {
    throw new Error("Missing Gemini API Key. Please set the GEMINI_API_KEY environment variable or pass the API key.");
  }

  const model = "gemini-2.5-flash"; // Highly reliable, fast JSON output
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiKey}`;

  const userPrompt = `
Here is the raw SVG string to optimize and refine into single-stroke centerlines:
\`\`\`xml
${rawSvg}
\`\`\`
`;

  const payload = {
    contents: [
      {
        parts: [
          { text: systemPrompt },
          { text: userPrompt }
        ]
      }
    ],
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: {
        type: "OBJECT",
        properties: {
          optimizedSvg: { type: "STRING" }
        },
        required: ["optimizedSvg"]
      }
    }
  };

  try {
    const res = await globalThis.fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      throw new Error(`Gemini API request failed with status ${res.status}: ${errText}`);
    }

    const data: any = await res.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
      throw new Error("Empty response returned from Gemini API.");
    }

    let cleanText = text.trim();
    if (cleanText.startsWith("```")) {
      cleanText = cleanText.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
    }
    cleanText = cleanText.trim();

    const parsed = JSON.parse(cleanText);
    if (!parsed.optimizedSvg) {
      throw new Error("Invalid response format: missing 'optimizedSvg' key.");
    }

    return { optimizedSvg: parsed.optimizedSvg };
  } catch (err: any) {
    console.error("[aiSvgRefiner] Failed to refine SVG using AI:", err);
    throw err;
  }
}
