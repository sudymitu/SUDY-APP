import { GoogleGenAI, GenerateContentResponse, Modality, Type } from "@google/genai";

const getAiClient = () => {
    const apiKey = process.env.API_KEY;

    if (!apiKey) {
        // This will prevent the app from making API calls without a key.
        // The error will be visible in the developer console.
        throw new Error('CRITICAL: API key is missing. The API_KEY environment variable must be configured.');
    }
    return new GoogleGenAI({ apiKey });
};


const fileToGenerativePart = (base64: string, mimeType: string) => {
  return {
    inlineData: {
      data: base64,
      mimeType,
    },
  };
};

export const generateLineArtFromImage = async (base64: string, mimeType: string): Promise<GenerateContentResponse> => {
    const ai = getAiClient();
    const imagePart = fileToGenerativePart(base64, mimeType);
    const textPart = { 
        text: `
        **Instruction:** Convert this architectural image into a clean, minimalist, black and white line drawing. The background must be pure white. Lines should be thin and precise.
        **Output Requirements:** The final image must be a line drawing only.
        **Negative Prompts (CRITICAL):** Do NOT include any of the following: perspective, 3D rendering, shading, shadows, gradients, colors, textures, materials, text, dimensions, annotations, people, or vegetation.
        `
    };

    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: { parts: [imagePart, textPart] },
        config: {
            responseModalities: [Modality.IMAGE, Modality.TEXT],
        },
    });
    return response;
};

export const generateImageFromImageAndText = async (prompt: string, imageBase64: string, mimeType: string): Promise<GenerateContentResponse> => {
    const ai = getAiClient();
    const imagePart = fileToGenerativePart(imageBase64, mimeType);
    const textPart = { text: prompt };

    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: {
            parts: [imagePart, textPart]
        },
        config: {
            responseModalities: [Modality.IMAGE, Modality.TEXT],
        },
    });
    return response;
};

export const generateImageWithElements = async (
    userPrompt: string,
    mainImage: {base64: string, mimeType: string}, 
    elementImages: {base64: string, mimeType: string, name: string}[],
    loraPrompt: string,
    creativity: number
): Promise<GenerateContentResponse> => {
    const ai = getAiClient();

    let elementDescription = '';
    if (elementImages.length > 0) {
        elementDescription = `
**REFERENCE ELEMENTS:**
- You have been provided with ${elementImages.length} reference element images after this text prompt. These are specific assets to be placed in the scene, not just style references. Their appearance must be preserved.
- The elements are provided in order and correspond to the following names used in the user's prompt:
${elementImages.map((el, index) => `- Element ${index + 1}: ${el.name}`).join('\n')}
`;
    }

    const finalPrompt = `
        **TASK:** Modify the main image based on the user's prompt, incorporating any provided reference elements. The main image is the VERY LAST image provided.
        
        **LoRA/Trained Style:** ${loraPrompt || 'None'}
        
        ${elementDescription}

        **User Prompt:** "${userPrompt}"
        
        **Creativity Level (0=faithful, 10=highly creative):** ${creativity}
        
        **Final Instruction:** Read the user's prompt carefully to understand where and how to place the named reference elements into the main image.
    `;
    
    const textPart = { text: finalPrompt };
    const mainImagePart = fileToGenerativePart(mainImage.base64, mainImage.mimeType);
    const elementParts = elementImages.map(img => fileToGenerativePart(img.base64, img.mimeType));

    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: {
            // The main image part MUST be last for the model to correctly use it as the base for edits.
            parts: [textPart, ...elementParts, mainImagePart]
        },
        config: {
            responseModalities: [Modality.IMAGE, Modality.TEXT],
        },
    });
    return response;
};

export const generatePerspectiveFromFloorplan = async (
    inpaintedPlan: { base64: string, mimeType: string },
    loraStylePrompt: string,
    sceneDescription: string,
    renderView: string,
    aspectRatio: string,
    elements: { base64: string, mimeType: string, name: string }[]
): Promise<GenerateContentResponse> => {
    const ai = getAiClient();
    const planPart = fileToGenerativePart(inpaintedPlan.base64, inpaintedPlan.mimeType);
    const elementParts = elements.map(el => fileToGenerativePart(el.base64, el.mimeType));

    const ratioMatch = aspectRatio.match(/(\d+:\d+)/);
    const validAspectRatio = ratioMatch ? ratioMatch[0] : '16:9';
    
    let elementsInstruction = '';
    if (elements.length > 0) {
        elementsInstruction = `
**4. INCORPORATE REFERENCE ELEMENTS:**
- You have been provided with ${elements.length} reference element images after this text prompt. These are specific assets that must be placed in the scene. Their appearance must be preserved.
- The user has named these in their 'Scene Description' (e.g., using '[sofa_style_1]'). The provided element images correspond to these names in order.
- You MUST place these specific objects into the scene as described. The elements are:
${elements.map((el, index) => `- Element ${index + 1}: Referenced as ${el.name} in the prompt.`).join('\n')}
`;
    }
    
    const textPart = {
        text: `
        **ROLE:** You are an AI that functions as a 3D architectural rendering engine. Your only output is a single, photorealistic image.

        **PRIMARY DIRECTIVE:** Your most critical task is to accurately interpret a 2D blueprint to create a 3D perspective. The floor plan you will be given is the VERY LAST image provided. Geometric accuracy and camera placement are paramount and must be prioritized over styling.

        ---
        **UNBREAKABLE RULES (Must be followed in this exact order):**
        ---

        **1. PARSE THE CAMERA VIEWPOINT:**
        - The input floor plan image contains a hand-drawn red marker (it could be an arrow, a cone, or a similar shape).
        - This marker is NOT a piece of furniture or an object in the scene. It is a **COMMAND** that defines the camera's exact position and viewing direction.
        - **Position:** Place the virtual camera at the **base** of the red arrow/cone.
        - **Direction:** Aim the camera **precisely** where the arrow/cone is pointing.
        - The final image you generate **MUST** be from this exact first-person viewpoint. This is the most important rule. Any deviation is a failure.

        **2. CONSTRUCT THE 3D GEOMETRY FROM THE BLUEPRINT:**
        - The black lines on the blueprint are solid, vertical walls. This layout is the **absolute, unchangeable truth** of the space.
        - You **MUST** build a 3D scene that is a geometrically perfect match to the blueprint as seen from the camera's perspective.
        - **NEGATIVE PROMPTS (GEOMETRY):** DO NOT alter wall positions. DO NOT change angles. DO NOT add or remove rooms. DO NOT ignore the provided layout. The blueprint is a strict schematic, not a suggestion.

        **3. FORMAT THE OUTPUT IMAGE:**
        - The final rendered image **MUST** be generated with an aspect ratio of **${validAspectRatio}**. This is a mandatory, non-negotiable output format requirement. Produce an image with these exact dimensions.
        
        ${elementsInstruction}

        ---
        **STYLING INSTRUCTIONS (Apply ONLY after following the rules above):**
        ---

        - Once the accurate 3D view is established, apply the aesthetic defined in the following 'Style Guide' and 'Scene Description'.
        - The style (materials, lighting, furniture) must be applied *inside* the constructed geometry. The style **CANNOT** change the architecture.
        - If reference elements are provided, their style should take precedence for those specific objects.

        **EXECUTION PAYLOAD:**
        - **Blueprint:** The provided source image (the final image in the sequence) with the red camera marker.
        - **Style Guide (JSON):** """${loraStylePrompt}"""
        - **Scene Description:** "${sceneDescription}"
        - **Render View:** "${renderView}"
        - **Reference Elements:** ${elements.length > 0 ? "Provided as subsequent images. The user will refer to them by names in the Scene Description." : "None."}
        - **Final Image Requirements:** The final render must be a clean, photorealistic image. It must NOT contain any text, dimensions, watermarks, annotations, or the red camera marker from the original blueprint.
        `
    };

    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        // The floor plan (planPart) MUST be the last image part for the model to use it as the base.
        contents: { parts: [textPart, ...elementParts, planPart] },
        config: {
            responseModalities: [Modality.IMAGE, Modality.TEXT],
        },
    });

    return response;
};


export const analyzeSceneForFloorplanRender = async (
    inpaintedPlan: { base64: string, mimeType: string },
    refImage: { base64: string, mimeType: string },
    language: string
): Promise<{ loraStylePrompt: object, description: string }> => {
    const ai = getAiClient();
    const planPart = fileToGenerativePart(inpaintedPlan.base64, inpaintedPlan.mimeType);
    const refImagePart = fileToGenerativePart(refImage.base64, refImage.mimeType);
    
    const textPart = {
        text: `
        You are an expert architectural and interior design analyst. You will be given a 2D floor plan with a red camera marker and a style reference image. Your task is to generate a JSON object with two keys: "loraStylePrompt" and "description".

        **Analysis Instructions:**

        1.  **Analyze Floor Plan and Camera Marker (for the "description" key):**
            *   Look at the floor plan to understand the layout.
            *   The red marker indicates the camera's position and viewing direction. Identify the room the camera is in.
            *   Based on the marker's location and direction, write a concise description of the view. State what room the camera is in and what it is looking towards. Example: "A view from the main living area, looking towards the open-plan kitchen and dining space. A large sliding glass door is visible on the far wall leading to a balcony."

        2.  **Analyze Style Reference Image (for the "loraStylePrompt" key):**
            *   Analyze the style reference image in extreme detail to create a style guide for the entire project.
            *   This guide will be a JSON object.
            *   This JSON object MUST contain keys like "style_mood", "materials_textures", "lighting_scheme", "color_palette", and "furniture_style". The values should be descriptive strings.

        **Output Language:** All text values in the final JSON must be in the following language: ${language}.
        `
    };

    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: { parts: [textPart, planPart, refImagePart] },
        config: {
            responseMimeType: 'application/json',
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    loraStylePrompt: {
                        type: Type.OBJECT,
                        properties: {
                            style_mood: { type: Type.STRING },
                            materials_textures: { type: Type.STRING },
                            lighting_scheme: { type: Type.STRING },
                            color_palette: { type: Type.STRING },
                            furniture_style: { type: Type.STRING }
                        },
                        description: "A detailed JSON object describing the project's overall aesthetic style based on the reference image."
                    },
                    description: {
                        type: Type.STRING,
                        description: "A description of the scene from the camera's perspective on the floor plan."
                    }
                }
            }
        }
    });

    return JSON.parse(response.text);
};

export const analyzeImageForRenderPrompt = async (
    base64: string, 
    mimeType: string, 
    currentPrompt: string,
    language: string
): Promise<string> => {
    const ai = getAiClient();
    const imagePart = fileToGenerativePart(base64, mimeType);
    const textPart = { 
        text: `You are an AI assistant for architects. Your task is to analyze an architectural image and generate a single, direct, command-based prompt suggesting a new, creative context for the image.

**User's initial text for context:** "${currentPrompt || 'Not provided. Analyze the image to suggest creative context.'}"

**Generation Instructions:**
1.  **Format:** The output must be a single string.
2.  **Content:** This string MUST start with a command phrase like "Biến ảnh này thành một bức ảnh chụp của..." or "Chuyển đổi hình ảnh này thành một cảnh render chân thực của...".
3.  **Creativity:** After the command phrase, you must creatively suggest a completely new context, environment, lighting, and mood. For example: "...một ngôi nhà gỗ mộc mạc giữa rừng thông vào một buổi sáng sương mù." or "...một công trình kiến trúc tương lai trên sao Hỏa vào lúc hoàng hôn."
4.  **Language**: The entire output string MUST be in the following language: **${language}**.
`
    };
    
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: { parts: [textPart, imagePart] },
    });

    return response.text;
};


export const analyzeImageForRegeneration = async (base64: string, mimeType: string): Promise<string> => {
    const ai = getAiClient();
    const imagePart = fileToGenerativePart(base64, mimeType);
    const textPart = {
        text: `
        Analyze this image with extreme detail for the purpose of recreating it with a text-to-image model. Your analysis must be a long, single-paragraph descriptive prompt.
        1.  **Overall Scene:** Describe the setting, mood, time of day, and lighting (e.g., 'A warmly lit, serene living room in an Indochine style apartment during golden hour sunset.').
        2.  **Composition:** Describe the camera angle and composition (e.g., 'Eye-level shot, centered on the open balcony doors, creating a strong sense of depth.').
        3.  **Key Subjects & Placement:** Describe every single object, person, or architectural feature and its exact position using relative terms (e.g., 'In the right foreground, a woman wearing a light blue Vietnamese ao dai is seated on a beige sofa. In the center, a dark wood coffee table sits on a patterned tile rug. In the background, a balcony overlooks a hazy city skyline.').
        4.  **Details & Textures:** Describe materials, textures, and small details with precision (e.g., 'The walls are paneled with a textured, golden-brown wallpaper. The floor is made of intricate black and white patterned tiles. The chandelier is ornate brass with candle-style bulbs.').
        5.  **Color Palette:** Describe the dominant colors.
        
        Combine all of this into a single, cohesive paragraph. Do not use lists or bullet points. The output must be in English.
        `
    };

    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: { parts: [imagePart, textPart] },
    });

    return response.text;
};

export const analyzeImageForFloorPlanStyle = async (base64: string, mimeType: string): Promise<string> => {
    const ai = getAiClient();
    const imagePart = fileToGenerativePart(base64, mimeType);
    const textPart = {
        text: `**Task:** You are an expert interior design analyst. Your goal is to analyze the provided image to create a universal, professional-grade style guide (like a LoRA prompt) for a **2D top-down floor plan coloring task**. The guide you create must be versatile enough to be applied to ANY room layout (living room, bedroom, kitchen, etc.), not just the one in the image.

**Core Instructions:**
1.  **Extract Principles, Not Just Items:** Do not just list the items in the photo. Instead, deduce the underlying design principles. What is the philosophy behind the color choices, material combinations, and overall mood?
2.  **Universal Applicability:** The output should be a general style definition. For example, instead of "a beige L-shaped sofa," the guide should specify "sofas should be simple geometric shapes in neutral, warm fabrics."
3.  **Top-Down Perspective:** All descriptions must be for a direct top-down orthographic view.

**Output Format (CRITICAL):**
The output must be a valid, well-formatted Python script string, at least 150 words long. Use functions, dictionaries, and comments for clarity.

**Structure:**
-   **Overall Style & Mood:** (e.g., # Style Definition -- Japandi, Biophilic, Moody, Serene, etc.)
-   **Universal Color Palette:** Define primary, secondary, and accent colors that define the style.
-   **Core Materials Palette:** Describe the key materials for flooring, furniture, and textiles that are characteristic of this style.
-   **Furniture Style (Top-Down):** Describe the general shapes and textures of furniture (sofas, beds, tables) as seen from above.
-   **Rug Style:** Describe typical rug patterns and textures.
-   **Shadow Style:** Define the desired shadow type (e.g., # Shadows -- soft ambient occlusion, no harsh shadows).
-   **Key Decor Principles:** Mention general decor elements (e.g., # Decor -- frequent use of potted plants, minimalist approach, etc.).

The final output should be a single block of text that acts as a comprehensive style guide.`
    };

    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: { parts: [imagePart, textPart] },
    });

    return response.text;
};

export const analyzeImageForStyle = async (base64: string, mimeType: string, language: string): Promise<string> => {
    const ai = getAiClient();
    const imagePart = fileToGenerativePart(base64, mimeType);
    const textPart = { 
        text: `You are an expert creative director and style analyst for architectural visualization. Analyze the provided image to create a detailed, professional-grade style guide prompt. The output must be a single, cohesive paragraph of descriptive keywords and phrases. Do NOT use lists or bullet points.

Focus on capturing the following elements in extreme detail:
1.  **Overall Mood & Atmosphere:** (e.g., 'serene and peaceful morning', 'dramatic and imposing on a stormy day', 'warm and cozy golden hour').
2.  **Lighting Scheme:** Describe the quality, color, and direction of light (e.g., 'soft diffused natural light from large windows', 'dramatic chiaroscuro with long shadows', 'warm ambient lighting from concealed LED strips').
3.  **Color Palette:** Describe the dominant and accent colors (e.g., 'a monochromatic palette of cool grays', 'earthy tones of terracotta and olive green', 'muted pastels with a pop of vibrant blue').
4.  **Environment & Context:** Describe the surrounding scene (e.g., 'a dense, misty pine forest', 'a bustling futuristic city street at night', 'a tranquil coastal setting with calm turquoise water').
5.  **Key Textures & Materials:** (e.g., 'raw concrete with visible formwork', 'polished terrazzo floors', 'blackened steel frames', 'bouclé fabrics').

The entire output string MUST be in the following language: **${language}**.
`
    };
    
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: { parts: [textPart, imagePart] },
    });

    return response.text;
};

export const analyzeImagesWithText = async (prompt: string, images: {base64: string, mimeType: string}[], language: string): Promise<string> => {
    const ai = getAiClient();
    const parts = [
        { text: prompt },
        ...images.map(img => fileToGenerativePart(img.base64, img.mimeType))
    ];

    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: { parts: parts },
        config: {
            systemInstruction: `You are an architectural analyst. Respond to the user's request based on the provided images. All your responses must be in the following language: ${language}.`,
        }
    });
    return response.text;
};

export const analyzeTrainingImages = async (prompt: string, images: {base64: string, mimeType: string}[]): Promise<string> => {
    const ai = getAiClient();
    const systemInstruction = `You are a world-class AI style analyst for architectural visualization, specializing in creating prompts for generative models like LoRA. Your task is to analyze a user's reference images and their initial description to create a highly detailed, professional-grade style prompt.

**Output Requirements:**
1.  **Language:** The entire output must be in **English**.
2.  **Length:** The analysis must be **at least 350 words**.
3.  **Format:** Structure the output as a valid, well-formatted Python script. Use functions (e.g., \`def define_style_parameters():\`), dictionaries, lists, and comments (\`#\`) to clearly structure the information. Each major aspect must be defined in its own function returning a dictionary of parameters.
4.  **Content:** The analysis must be incredibly detailed. Synthesize information from ALL reference images and the user's prompt. Cover the following aspects in extreme detail:
    *   **Overall Style & Mood:** (e.g., # Style Definition -- Japandi, Biophilic, Deconstructivism, Moody, Serene, etc.)
    *   **Architectural Elements:** (e.g., # Architectural Features -- clean lines, brutalist forms, cantilevered volumes, exposed beams, etc.)
    *   **Materials & Textures:** (e.g., # Materials Palette -- raw concrete with visible formwork, polished terrazzo floors, blackened steel frames, bouclé fabrics, etc.)
    *   **Lighting Scheme:** (e.g., # Lighting -- soft diffused natural light from large apertures, dramatic chiaroscuro, warm ambient lighting from concealed LED strips, golden hour, etc.)
    *   **Color Palette:** (e.g., # Color Scheme -- monochromatic, earthy tones, muted pastels, specific hex codes if identifiable, etc.)
    *   **Composition & Camera:** (e.g., # Composition -- centered, rule of thirds, leading lines, specific camera angles like worm's-eye view, lens suggestions like 35mm lens, shallow depth of field, etc.)
    *   **Environment & Context:** (e.g., # Context -- dense forest, coastal setting, overcast sky, etc.)
    *   **Key Details & Decor:** (e.g., # Key Details -- minimalist furniture, specific plant types, unique structural joints, etc.)

The final output should be a single block of text, ready to be used as a powerful, comprehensive style prompt.`;

    const parts = [
        { text: `User's initial description: "${prompt}". Analyze the provided reference images based on this description and generate the detailed style prompt.` },
        ...images.map(img => fileToGenerativePart(img.base64, img.mimeType))
    ];

    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: { parts: parts },
        config: {
            systemInstruction: systemInstruction,
        }
    });
    return response.text;
};

export const extractArchitecturalFeatures = async (images: {base64: string, mimeType: string}[], featureType: 'geometry' | 'material'): Promise<GenerateContentResponse> => {
    const ai = getAiClient();
    
    let prompt;
    if (featureType === 'geometry') {
        prompt = `
        **TASK:** Analyze the provided architectural images. 
        **INSTRUCTION:** Extract the dominant geometric forms, structural lines, and core shapes from all images. Synthesize these elements into a single, abstract, black and white line drawing. 
        **OUTPUT REQUIREMENTS:**
        - The background MUST be pure white (#FFFFFF).
        - All lines MUST be black (#000000).
        - The result should be a clean, minimalist, abstract composition representing the shared architectural language of the inputs.
        **NEGATIVE PROMPTS:** Do NOT include any color, shading, texture, perspective, 3D effects, or specific building representations. This is an abstract feature extraction, not a technical drawing.
        `;
    } else { // material
        prompt = `
        **TASK:** Analyze the provided architectural images.
        **INSTRUCTION:** Identify the key materials and textures present (e.g., concrete texture, wood grain, fabric weave, metal sheen, stone patterns). 
        **OUTPUT REQUIREMENTS:**
        - Create a moodboard-style image that showcases these textures as a visually appealing collage or palette.
        - Arrange the textures in clean geometric shapes (squares, rectangles).
        - The overall image should feel like a professional material sample board.
        **NEGATIVE PROMPTS:** Do NOT render a realistic scene or building. The output must be an abstract collage of textures and materials only.
        `;
    }

    const imageParts = images.map(img => fileToGenerativePart(img.base64, img.mimeType));
    const textPart = { text: prompt };

    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: {
            parts: [textPart, ...imageParts]
        },
        config: {
            responseModalities: [Modality.IMAGE, Modality.TEXT],
        },
    });

    return response;
};

export const optimizePrompt = async (prompt: string, language: string): Promise<string> => {
    const ai = getAiClient();
    const instruction = `You are an expert in architectural and interior design visualization. Your task is to take a user's simple prompt and expand it into a detailed, professional prompt suitable for an AI image generator. The final output must be in the same language as the user's prompt (${language}).
First, you will silently determine if the user's prompt is for an 'interior' or 'exterior' scene.
Then, based on that determination, you MUST EMPHASIZE lighting details.
- For INTERIOR scenes, you MUST add specific details about artificial lighting like **indoor lamps, spotlights, pendant lights, concealed LED strips, and mood lighting to create a specific atmosphere (e.g., warm and cozy, dramatic, professional)**.
- For EXTERIOR scenes, you MUST add specific details about environmental and architectural lighting like **streetlights casting long shadows, uplighting on the building facade, glowing lights from windows, pathway lights, and landscape lighting**.
In addition, you will add comma-separated details about architectural style, materials, mood, composition, camera angle, and lens (e.g., wide-angle, 35mm).
The final output should be a single, coherent paragraph of keywords and phrases, NOT a list, and it must be in ${language}.`;

    const fullPrompt = `User prompt to optimize: "${prompt}"`;

    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: fullPrompt,
        config: {
            systemInstruction: instruction,
        }
    });
    return response.text;
};

export const optimizeEnhancePrompt = async (prompt: string, imageBase64: string, mimeType: string, language: string): Promise<string> => {
    const ai = getAiClient();
    const instruction = `You are an expert in architectural and interior design visualization, acting as a "prompt engineer" for an image editing AI. Your task is to take a user's simple editing instruction and the original image, then write a new, highly descriptive prompt that describes the *final, desired image* in full detail. The new prompt must be in the same language as the user's original instruction (${language}).

**Process:**
1.  **Analyze the Image:** Understand the content, style, composition, lighting, and mood of the source image.
2.  **Analyze the Request:** Understand the specific change the user wants to make.
3.  **Synthesize:** Create a new, single-paragraph prompt that describes the entire scene *as if it already has the user's changes*. Do not just describe the change. For example, if the user says "add a red sofa", you should describe the whole room, including the new red sofa in its context.
4.  **Maintain Style:** The new prompt must preserve the original image's style (e.g., photorealistic, watercolor, etc.), lighting, and overall mood, unless the user explicitly asks to change them.
5.  **Output Format:** The final output must be a single, cohesive paragraph of keywords and descriptive phrases, NOT a list, and it must be in ${language}.`;

    const textPart = { text: `User's editing instruction: "${prompt}"` };
    const imagePart = fileToGenerativePart(imageBase64, mimeType);

    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: { parts: [textPart, imagePart] },
        config: {
            systemInstruction: instruction,
        }
    });
    return response.text;
};

export const optimizePromptWithImages = async (prompt: string, images: {base64: string, mimeType: string}[], language: string): Promise<string> => {
    const ai = getAiClient();
    const instruction = `You are an expert in architectural and interior design visualization. Your task is to take a user's prompt and reference images, then expand it into a detailed, professional prompt for an AI image generator. The output must be in the same language as the user's prompt (${language}).
Analyze the user's prompt AND the images. Extract key elements: architectural style, materials, lighting (e.g., cinematic, golden hour), mood, composition, camera angle, and lens (e.g., wide-angle, 35mm).
Combine the user's text prompt with the visual information from the images to create a single, rich, descriptive paragraph of keywords and phrases. Do NOT use a list format. The entire response must be in ${language}.`;

    const textPart = { text: `User prompt to optimize: "${prompt}"` };
    const imageParts = images.map(img => fileToGenerativePart(img.base64, img.mimeType));

    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: { parts: [textPart, ...imageParts] },
        config: {
            systemInstruction: instruction,
        }
    });
    return response.text;
};

export const generateImageFromText = async (prompt: string, aspectRatio: string, count: number, modelValue: string): Promise<string[]> => {
    const ai = getAiClient();
    let model = modelValue;
    let finalPrompt = prompt;

    // Handle the custom "ultra" model value for higher quality prompt
    if (modelValue === 'imagen-4.0-generate-001-ultra') {
        model = 'imagen-4.0-generate-001';
        finalPrompt = `${prompt}, ultra high quality, 2k resolution, photorealistic, sharp focus, detailed`;
    }
    
    const ratioMatch = aspectRatio.match(/(\d+:\d+)/);
    const validAspectRatio = ratioMatch ? ratioMatch[0] : '1:1';

    const response = await ai.models.generateImages({
        model,
        prompt: finalPrompt,
        config: {
            numberOfImages: count,
            outputMimeType: 'image/jpeg',
            aspectRatio: validAspectRatio,
        },
    });
    
    return response.generatedImages.map(img => img.image.imageBytes);
};

export const removeImageBackground = async (base64: string, mimeType: string): Promise<GenerateContentResponse> => {
    const ai = getAiClient();
    const imagePart = fileToGenerativePart(base64, mimeType);
    const textPart = { 
        text: `
        **Instruction:** Isolate the main subject of this image and make the background transparent.
        **Output Requirements:** The output image MUST have a transparent background (alpha channel). The subject should be perfectly preserved with clean edges. Do not add any new elements, shadows, or reflections. Just return the modified image.
        `
    };

    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: { parts: [imagePart, textPart] },
        config: {
            responseModalities: [Modality.IMAGE, Modality.TEXT],
        },
    });
    return response;
};

export const magicMixImage = async (
    compositeImage: { base64: string, mimeType: string }
): Promise<GenerateContentResponse> => {
    const ai = getAiClient();
    
    const prompt = `**TASK:** You are an expert photo editor. You are given a roughly composited image containing a background and an overlaid element that does not blend well.
    **INSTRUCTION:** Your task is to seamlessly and photorealistically blend the overlaid element into the background scene. You must correct for lighting, shadows, color grading, perspective, and edges to make the element look like it was originally part of the photo. The final output must be a clean, single, cohesive image with the same dimensions as the input.`;

    const imagePart = fileToGenerativePart(compositeImage.base64, compositeImage.mimeType);
    
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: { parts: [{text: prompt}, imagePart] },
        config: {
            responseModalities: [Modality.IMAGE, Modality.TEXT],
        },
    });
    return response;
};

export const upscaleImageTo4K = async (base64: string, mimeType: string): Promise<GenerateContentResponse> => {
    const ai = getAiClient();
    const imagePart = fileToGenerativePart(base64, mimeType);
    const textPart = {
        text: `
        **Instruction:** Upscale this image to a high resolution suitable for printing (approximately 4K).
        **Action:** Enhance all details, increase sharpness, and improve overall clarity and photorealism.
        **CRITICAL:** Do NOT add, remove, or change any elements, objects, or the composition of the original image. The goal is a higher-fidelity version of the exact same image.
        `
    };

    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: { parts: [imagePart, textPart] },
        config: {
            responseModalities: [Modality.IMAGE, Modality.TEXT],
        },
    });
    return response;
};

export const startVideoGeneration = async (prompt: string, imageBase64: string, mimeType: string, aspectRatio: string) => {
    const ai = getAiClient();
    const finalPrompt = `${prompt}, cinematic video, ${aspectRatio} aspect ratio`;
    const operation = await ai.models.generateVideos({
        model: 'veo-2.0-generate-001',
        prompt: finalPrompt,
        image: {
            imageBytes: imageBase64,
            mimeType: mimeType,
        },
        config: {
            numberOfVideos: 1
        }
    });
    return operation;
};

export const checkVideoOperationStatus = async (operation: any) => {
    const ai = getAiClient();
    const updatedOperation = await ai.operations.getVideosOperation({ operation: operation });
    return updatedOperation;
};

export const optimizeVideoPrompt = async (prompt: string, language: string): Promise<string> => {
    const ai = getAiClient();
    const instruction = `You are an expert in architectural visualization cinematography. Your task is to take a user's prompt and expand it into a detailed, professional prompt for the Veo video generation model. The output must be in the same language as the user's prompt (${language}).
Focus on describing:
1.  **Camera Movement:** Specify stable and cinematic movements like 'slow pan from left to right', 'gentle zoom in', 'smooth dolly forward', 'crane shot rising up', 'orbital shot around the building'. Avoid shaky or handheld descriptions.
2.  **Scene Dynamics:** Describe what is happening in the scene. e.g., 'clouds moving in a timelapse', 'light changing from dawn to day', 'leaves rustling in the wind', 'cars driving by with light trails at night'.
3.  **Visual Style:** Describe the overall aesthetic. e.g., 'cinematic, photorealistic, 8k resolution, high detail, sharp focus, dramatic lighting'.
The final output should be a single, cohesive paragraph of keywords and phrases.`;

    const fullPrompt = `User prompt to optimize: "${prompt}"`;

    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: fullPrompt,
        config: {
            systemInstruction: instruction,
        }
    });
    return response.text;
};

export const getBase64FromResponse = (response: GenerateContentResponse): string | null => {
    for (const part of response.candidates?.[0]?.content?.parts || []) {
        if (part.inlineData) {
            return part.inlineData.data;
        }
    }
    return null;
};

export const getChatbotResponse = async (
    prompt: string, 
    image: { base64: string; mimeType: string } | null,
    language: string
): Promise<string> => {
    const ai = getAiClient();
    
    const systemInstruction = `You are "Sudy", a friendly and knowledgeable AI assistant for an architectural design web app. Your goal is to understand the user's intent and guide them to the correct feature/tab, providing a clear explanation, a suggested prompt, and the name of the correct tab.

**Workflow Logic (CRITICAL):**
1.  **Sketch to Render:** If the user uploads a sketch, line drawing, or CAD drawing (e.g., from SketchUp, AutoCAD) and asks to render it or make it realistic, you **MUST** recommend they use the **'RenderAI'** tab. Instruct them to check the **'Render from line art'** option. Explain that this process gives them much greater creative control over the final style.
2.  **Object Isolation/Extraction:** If the user uploads a photo and asks to isolate, extract, or keep only one object (e.g., "I just want the sofa", "remove everything but the chair"), you **MUST** recommend they use the **'Enhance'** tab. Instruct them to use the **Inpainting tool** by drawing a **single small dot** on the object they want to keep, and then use a prompt like "remove everything else except the object marked with a dot."

**Available Tabs & their purpose:**
- 'Enhance': For editing, inpainting (adding/removing objects), or changing parts of an existing image.
- 'QuickGenerate': For creating new images from a text prompt only.
- 'RenderAI': For re-imagining an existing image in a new style or context (e.g., changing a day scene to night). Best for sketches and 3D models.
- 'FloorPlanRender': For creating a 3D perspective view from a 2D floor plan drawing.
- 'ImageFromReference': For analyzing a style from multiple images and generating new images in that style.
- 'VirtualTour': For creating an interactive step-by-step tour from a single image.

**Response Language:** Your entire JSON output MUST be in the language specified: ${language}.

**Output Format (Strict):**
You MUST respond with a single, valid JSON object with NO markdown formatting. The JSON object must have these keys:
- "explanation": (string) A friendly, conversational explanation of your recommendation.
- "suggested_prompt": (string) A high-quality, detailed prompt for the user to use in the recommended tab.
- "recommended_tab": (string) The exact name of the tab from the list above (e.g., 'Enhance', 'RenderAI').
- "action_button_text": (string) A short, action-oriented text for the button, like "Go to Enhance & Edit" in the user's language.`;

    const parts: any[] = [{ text: `User's request: "${prompt}"` }];
    if (image) {
        parts.push(fileToGenerativePart(image.base64, image.mimeType));
    }

    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: { parts },
        config: {
            systemInstruction,
            responseMimeType: 'application/json',
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    explanation: { type: Type.STRING },
                    suggested_prompt: { type: Type.STRING },
                    recommended_tab: { type: Type.STRING },
                    action_button_text: { type: Type.STRING },
                },
                required: ["explanation", "suggested_prompt", "recommended_tab", "action_button_text"]
            }
        },
    });

    return response.text;
};