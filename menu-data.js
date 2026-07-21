// Menu/tutorial static data: onboarding steps and scenario-card backgrounds (pure data).

export const conquestTutorialSteps = [
    {
        icon: "⚔️",
        title: "Welcome Commander",
        content: "Modern Wars is a grand strategy simulation of <b>organic frontlines</b>. Let's walk through a basic engagement setup.",
        actionRequired: "CLICK_NEXT"
    },
    {
        icon: "🌍",
        title: "Initialize World",
        content: "First, let's load the global theater. Click 'Next' to initialize the engine.",
        actionRequired: "LOAD_MAP"
    },
    {
        icon: "🇩🇪",
        title: "Recruit Side A",
        content: "We need an aggressor. Find <b>Germany</b> on the map and click it to recruit for Side A.",
        actionRequired: "SELECT_GERMANY"
    },
    {
        icon: "🇵🇱",
        title: "Recruit Side B",
        content: "Now for the opposition. Switch to <b>Side B</b> in the setup panel, then click <b>Poland</b> on the map.",
        actionRequired: "SELECT_POLAND"
    },
    {
        icon: "⚔️",
        title: "Launch Operation",
        content: "Both sides are ready. Click <b>Inaugurate Conflict</b> to begin the simulation.",
        actionRequired: "START_WAR"
    },
    {
        icon: "🛡️",
        title: "The Frontline",
        content: "The war is live! Units will now push borders organically. You can use <b>God Mode</b> to edit the map while the simulation runs. Good luck, Commander.",
        actionRequired: "CLICK_FINISH"
    }
];

export const editorTutorialSteps = [
    {
        icon: "🛠️",
        title: "World Builder",
        content: "Welcome to the <b>Satellite Editor</b>. Here you can redraw history or create entirely new worlds from scratch.",
        actionRequired: "CLICK_NEXT"
    },
    {
        icon: "🏳️",
        title: "Establish Nations",
        content: "First, click the <b>New Nation</b> button in the top-left toolbox. Define its name and color, then <b>click on the map</b> to establish its capital.",
        actionRequired: "CLICK_NEXT"
    },
    {
        icon: "🎨",
        title: "Painting Borders",
        content: "Once a nation exists, <b>select it</b> on the map to open the <b>Inspector</b>. Use the <b>Manual Paint</b> tool to grow its territory cell by cell.",
        actionRequired: "CLICK_NEXT"
    },
    {
        icon: "📐",
        title: "Annexation Tool",
        content: "Want modern borders instantly? Use the <b>Annex Tool</b> in the Inspector. Type a name like <b>'France'</b> to absorb its real-world territory.",
        actionRequired: "CLICK_NEXT"
    },
    {
        icon: "📥",
        title: "The Library",
        content: "Don't build alone. The <b>Country Library</b> lets you import nations designed by the community directly into your map.",
        actionRequired: "CLICK_NEXT"
    },
    {
        icon: "💾",
        title: "Share Your Vision",
        content: "Once your map is complete, use <b>Save Preset</b> to keep it locally, or <b>Share to Hub</b> for others to play and remix!",
        actionRequired: "CLICK_FINISH"
    }
];

export const SCENARIO_MENU_BGS = {
    'scroller-choice-modern': '/assets/img/menu/2022.webp',
    'scroller-choice-1974': '/assets/img/menu/1974.webp',

    'scroller-choice-1942': '/assets/img/menu/1942.webp',
    'scroller-choice-1936': '/assets/img/menu/1936.webp',
    'scroller-choice-1914': '/assets/img/menu/1914.webp',
    'scroller-choice-1804': '/assets/img/menu/1804.webp',
    'scroller-choice-1492': '/assets/img/menu/1492.webp',
    'scroller-choice-1ad': '/assets/img/menu/1.webp',
    'scroller-choice-canada': '/assets/img/menu/2022.webp',
    'scroller-choice-france': '/assets/img/menu/2022.webp',
    'scroller-choice-germany': '/assets/img/menu/2022.webp',
    'scroller-choice-england': '/assets/img/menu/2022.webp',
    'scroller-choice-us': '/assets/img/menu/2022.webp',
    'scroller-choice-poland': '/assets/img/menu/2022.webp',
    'scroller-choice-kaiserreich': '/assets/img/menu/1936.webp',
    'scroller-choice-fire': '/assets/img/menu/2022.webp',
    'scroller-choice-1984-alt': '/assets/img/menu/1974.webp',
    'scroller-choice-continental': '/assets/img/menu/2022.webp',
    'scroller-choice-tno': '/assets/img/menu/1936.webp'
};
