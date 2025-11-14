import "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { imageBase64 } = await req.json();
    
    if (!imageBase64) {
      throw new Error('No image provided');
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    // Use Lovable AI (Gemini 2.5 Flash) to extract product information from image
    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'system',
            content: `You are an expert at extracting product information from images. 
Extract the following information from product packaging images:
- Product name
- Brand name
- Barcode/GTIN (if visible)
- Expiry date (in YYYY-MM-DD format)
- Batch code
- MRP/price
- Quantity
- Manufacturing date (if visible)

Return the data as a valid JSON object with these exact keys:
{
  "productName": "string",
  "brand": "string",
  "gtin": "string or null",
  "expiryDate": "YYYY-MM-DD or null",
  "batchCode": "string or null",
  "mrp": "number or null",
  "quantity": "number or null",
  "manufacturingDate": "YYYY-MM-DD or null",
  "confidence": {
    "productName": 0-1,
    "expiryDate": 0-1,
    "overall": 0-1
  }
}

If you can't extract a field, set it to null. Provide confidence scores (0-1) for key fields.`
          },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'Extract product information from this image:'
              },
              {
                type: 'image_url',
                image_url: {
                  url: `data:image/jpeg;base64,${imageBase64}`
                }
              }
            ]
          }
        ],
        max_tokens: 1000,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Lovable AI error:', response.status, errorText);
      
      if (response.status === 429) {
        throw new Error('Rate limit exceeded. Please try again later.');
      }
      if (response.status === 402) {
        throw new Error('AI credits exhausted. Please add credits to continue.');
      }
      
      throw new Error(`AI service error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error('No response from AI service');
    }

    // Extract JSON from markdown code blocks if present
    let jsonStr = content.trim();
    if (jsonStr.includes('```json')) {
      jsonStr = jsonStr.split('```json')[1].split('```')[0].trim();
    } else if (jsonStr.includes('```')) {
      jsonStr = jsonStr.split('```')[1].split('```')[0].trim();
    }

    const extractedData = JSON.parse(jsonStr);

    console.log('Extracted product data:', extractedData);

    return new Response(
      JSON.stringify(extractedData),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error: any) {
    console.error('Error in ocr-scan function:', error);
    return new Response(
      JSON.stringify({
        error: error.message || 'Failed to process image',
        details: error.toString()
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});