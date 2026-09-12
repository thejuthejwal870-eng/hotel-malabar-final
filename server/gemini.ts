import { GoogleGenAI, Type } from '@google/genai';

export interface ExtractedMenuItem {
  name: string;
  categoryId: string;
  price: number | null;
  isVeg: boolean;
  description: string;
}

let aiClient: GoogleGenAI | null = null;

export function getGeminiClient(): GoogleGenAI {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY is not configured. Please add your key in the Settings > Secrets menu.');
    }
    aiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return aiClient;
}

export async function extractMenuItemsFromPhotos(
  images: Array<{ data: string; mimeType?: string }>,
  categories: Array<{ id: string; name: string }>
): Promise<ExtractedMenuItem[]> {
  if (!images || images.length === 0) {
    throw new Error('No menu photos provided for extraction.');
  }

  const ai = getGeminiClient();

  const categoriesListFormatted = categories
    .map((c) => `- Category Name: "${c.name}", Category ID: "${c.id}"`)
    .join('\n');

  // Clean base64 strings: remove data URI prefix if present
  const imageParts = images.map((img, index) => {
    let rawData = img.data || '';
    let mimeType = img.mimeType || 'image/jpeg';

    if (rawData.includes(';base64,')) {
      const parts = rawData.split(';base64,');
      const mimeMatch = parts[0].match(/data:(image\/[a-zA-Z0-9+.-]+)/);
      if (mimeMatch) {
        mimeType = mimeMatch[1];
      }
      rawData = parts[1];
    }

    return {
      inlineData: {
        mimeType,
        data: rawData.trim(),
      },
    };
  });

  const promptText = `You are a menu digitization assistant for "Hotel Malabar", an authentic South Indian and Malabar restaurant.

TASK:
1. Carefully read and transcribe all food and drink dishes visible across all the uploaded menu card photos.
2. EXTRACT ONLY GENUINE ORDERABLE FOOD AND BEVERAGE ITEM NAMES.
   - Strictly IGNORE restaurant headers, branding ('HOTEL MALABAR', logos), location/address details, phone numbers, opening timings, tax/GST disclaimers, dietary notices, and section title headings (do not extract words like 'STARTERS', 'BIRYANI SPECIALS', 'BEVERAGES' as items).
   - Extract individual items like "Chicken Dum Biryani", "Malabar Parotta", "Beef Roast", "Appam", "Karimeen Pollichathu", "Sulaimani", "Shawarma Roll", "Dragon Chicken", "Ghee Rice", "Meals", etc.
3. CATEGORIZATION:
   Organize each detected item into one of the following existing Hotel Malabar category IDs based on item type:
${categoriesListFormatted}

   Guidelines for categorization:
   - Parotta, Naan, Roti, Chappathi, Kulcha -> Roti Items
   - Idli, Dosa, Puttu, Appam, Idiyappam, Poori, Vada -> Breakfast
   - Biryani variations (Chicken, Mutton, Beef, Veg, Prawns Biryani, Kappa Biryani) -> Biryani
   - Tandoori chicken, Tikka, Kebabs -> Tandoori
   - Shawarma, Alfahm, BBQ, Grilled chicken -> Grill & Shawarma
   - Fish, Prawns, Crab, Squid, Karimeen, King fish -> Sea Food
   - Meals, Kerala Sadhya, Thali -> Meals
   - Non-veg curries (Chicken Curry, Beef Roast, Mutton Gravy) -> Non Veg Curry
   - Veg curries (Paneer Butter Masala, Dal Fry, Kadai Veg) -> Veg Curry
   - Non-veg dry starters (Chilli Chicken, Chicken 65) -> Non Veg Starters
   - Veg dry starters (Gobi 65, Paneer Tikka, Crispy Corn) -> Veg Starters
   - Egg dishes (Egg Roast, Omelette, Egg Burji) -> Egg Items
   - Fried rice varieties -> Chinese Rice
   - Noodles varieties -> Noodles
   - Soups -> Chinese Soup
   - Plain/Jeera/Ghee Rice -> Rice
   - Tea, Coffee, Sulaimani -> Tea / Coffee
   - Mojitos -> Mojitos
   - Milkshakes -> Milk Shake
   - Fresh Juices -> Fresh Juice
   - Lassi, Falooda -> Lassi & Falooda
   - Desserts, Ice creams -> Desserts

4. PRICE EXTRACTION:
   - If a numeric price is clearly visible and readable next to or corresponding to the item (e.g. 180, 220, 60), extract it as a number.
   - If the price is unclear, cut off, smeared, absent, or varies by portion without a single clear price, set price to null (or 0). Do NOT invent prices.

5. DIETARY & DETAILS:
   - Set isVeg: true if it is vegetarian, false if it contains chicken, mutton, beef, seafood, fish, or egg.
   - Set description: a concise 1-sentence note (or empty string).

Adhere strictly to the JSON schema output.`;

  const response = await ai.models.generateContent({
    model: 'gemini-3.8-flash',
    contents: [
      ...imageParts,
      {
        text: promptText,
      },
    ],
    config: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.ARRAY,
        description: 'List of extracted food and drink items from the menu card photos',
        items: {
          type: Type.OBJECT,
          properties: {
            name: {
              type: Type.STRING,
              description: 'The exact food or beverage item name',
            },
            categoryId: {
              type: Type.STRING,
              description: 'The category ID from the provided list',
            },
            price: {
              type: Type.NUMBER,
              description: 'Numeric price if readable, otherwise 0 or null',
            },
            isVeg: {
              type: Type.BOOLEAN,
              description: 'True if vegetarian, false if non-vegetarian',
            },
            description: {
              type: Type.STRING,
              description: 'Short 1-sentence description or empty string',
            },
          },
          required: ['name', 'categoryId', 'isVeg'],
        },
      },
    },
  });

  const responseText = response.text || '[]';
  let rawItems: any[] = [];
  try {
    rawItems = JSON.parse(responseText);
  } catch (parseErr) {
    console.error('Failed to parse Gemini JSON output:', parseErr, responseText);
    throw new Error('AI was unable to parse the menu items into the required format. Please try with clearer photos.');
  }

  if (!Array.isArray(rawItems)) {
    rawItems = [];
  }

  const validCategoryIds = new Set(categories.map((c) => c.id));
  const categoryByName = new Map(categories.map((c) => [c.name.toLowerCase().trim(), c.id]));
  const defaultCategoryId = categories[0]?.id || 'cat_biryani';

  const cleanedItems: ExtractedMenuItem[] = [];

  for (const raw of rawItems) {
    const name = String(raw.name || '').trim();
    if (!name || name.length < 2) continue;

    // Filter out obvious header words or noise if any slipped through
    const lowerName = name.toLowerCase();
    if (
      lowerName === 'menu' ||
      lowerName === 'hotel malabar' ||
      lowerName === 'rate' ||
      lowerName === 'price' ||
      lowerName === 'items'
    ) {
      continue;
    }

    let categoryId = String(raw.categoryId || '').trim();
    if (!validCategoryIds.has(categoryId)) {
      // Try resolving by name
      const matched = categoryByName.get(categoryId.toLowerCase());
      categoryId = matched || defaultCategoryId;
    }

    let price: number | null = null;
    if (typeof raw.price === 'number' && !isNaN(raw.price) && raw.price > 0) {
      price = Math.round(raw.price);
    }

    cleanedItems.push({
      name,
      categoryId,
      price,
      isVeg: Boolean(raw.isVeg),
      description: String(raw.description || '').trim(),
    });
  }

  return cleanedItems;
}
