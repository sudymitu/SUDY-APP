

export const MODERN_MINIMALIST_STYLE = `
def define_style_parameters():
    # Style: Modern Minimalist, colored top-down 2D floor plan
    return {
        "overall_mood": "Clean, bright, and highly organized.",
        "color_palette": {
            "primary": "White (#FFFFFF) and light gray (#E0E0E0) for walls and large furniture.",
            "secondary": "Charcoal gray (#333333) for accents, door frames.",
            "accent": "Natural light wood tones for flooring and select furniture."
        },
        "materials": {
            "flooring": "Seamless light concrete texture or light oak wood planks.",
            "furniture_tops": "Render furniture blocks with solid colors (grays, whites) or a simple wood texture for tables.",
            "rugs": "Simple, solid color area rugs in a darker gray."
        },
        "furniture_style_top_down": {
            "sofa": "Render as a simple L-shape or rectangular block in light gray.",
            "beds": "Render as a rectangular block with two white pillows.",
            "tables": "Circular or rectangular shapes with a clean wood or white texture.",
            "chairs": "Simple circle or square shapes around tables."
        },
        "shadows": "Add very soft, subtle ambient occlusion shadows around furniture and walls to give a slight sense of depth, but maintain a 2D look.",
        "decor": "Minimal. Render a few small green circles to represent potted plants."
    }
`;

export const JAPANESE_STYLE = `
def define_style_parameters():
    # Style: Japanese (Wabi-Sabi & Zen influences), colored top-down 2D floor plan
    return {
        "overall_mood": "Serene, tranquil, minimalist, and connected to nature.",
        "color_palette": {
            "primary": "Off-white and beige for walls.",
            "secondary": "Natural wood tones (light maple, dark cedar).",
            "accent": "Dark gray or black for accents, and muted green for plants."
        },
        "materials": {
            "flooring": "Light wood planks or tatami mat texture.",
            "furniture_tops": "Low-profile furniture with natural wood grain. Futon beds are simple white rectangles.",
            "rugs": "Simple, plain rugs in natural fibers like jute or sisal, or no rugs at all."
        },
        "furniture_style_top_down": {
            "sofa": "Low, simple rectangular shapes in neutral fabrics.",
            "beds": "Render as a low platform or futon, simple white bedding.",
            "tables": "Low-to-the-ground wooden tables (chabudai).",
            "chairs": "Floor cushions (zabuton) represented as simple squares."
        },
        "shadows": "Very soft, natural ambient shadows.",
        "decor": "Minimalist decor. A single bonsai tree or ikebana flower arrangement, represented by a simple plant symbol. Shoji screen patterns on partition lines."
    }
`;

export const NEOCLASSICAL_STYLE = `
def define_style_parameters():
    # Style: Neoclassical, colored top-down 2D floor plan
    return {
        "overall_mood": "Elegant, grand, and symmetrical.",
        "color_palette": {
            "primary": "Cream, beige, and soft grays for walls.",
            "secondary": "Golds, silvers, and brass for accents.",
            "accent": "Rich colors like deep blue, burgundy, or forest green for furniture."
        },
        "materials": {
            "flooring": "Polished marble with geometric patterns or dark, polished herringbone wood floors.",
            "furniture_tops": "Dark, polished wood (mahogany, walnut). Sofas and beds are rich velvet or damask textures.",
            "rugs": "Ornate, classic Persian or Aubusson rugs with intricate floral and medallion patterns."
        },
        "furniture_style_top_down": {
            "sofa": "Render as classic shapes like Chesterfield or Camelback in rich colors.",
            "beds": "Large beds with ornate headboards, represented with tufted textures.",
            "tables": "Ornate tables with carved legs, often circular or oval.",
            "chairs": "Elegant chairs with curved lines."
        },
        "shadows": "Soft shadows that emphasize the richness of textures.",
        "decor": "Symmetry is key. Wall moldings should be hinted at with subtle lines. Grand chandeliers can be represented by a central circular pattern."
    }
`;
