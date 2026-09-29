// SFBB starter model for the HACCP screens.
// Source: FSA "Safer food, better business for caterers" (2024 pack).
// These are starter controls, not a declaration that a business follows them.
// The businessProcedure, owner and sign-off fields must be completed on site.

export const SFBB_SOURCE_URL =
  "https://assets.publishing.service.gov.uk/media/69c5247ecdfd19de13d0f6ca/sfbb-caterers-pack-fixed_0_3.pdf";

export const SFBB_CATEGORIES = [
  "Cross-contamination",
  "Cleaning",
  "Chilling",
  "Cooking",
  "Management",
];

export const HAZARD_TYPES = ["Biological", "Chemical", "Physical", "Allergen"];

export const MONITORING_FREQUENCIES = [
  "Per batch",
  "Per delivery",
  "Per service",
  "Every shift",
  "Hourly",
  "Twice daily",
  "Daily",
  "Weekly",
  "4-weekly",
  "Monthly",
  "When changed",
];

export const emptySafeMethod = () => ({
  templateKey: "",
  name: "",
  category: "Cross-contamination",
  controlType: "Safe method",
  appliesToBusiness: true,
  isCCP: false,
  step: "",
  hazardTypes: ["Biological"],
  hazardType: "Biological", // retained for backwards compatibility
  safetyPoint: "",
  whyImportant: "",
  safetyChecks: [],
  businessProcedure: "",
  checkMethod: "",
  limitMin: "",
  limitMax: "",
  limitText: "",
  monitoringMethod: "",
  monitoringFrequency: "Daily",
  monitoringResponsible: "",
  correctiveAction: "",
  preventionAction: "",
  verification: "",
  records: "HACCP evidence log",
  trainingRequired: "",
  completedDate: "",
  completedBy: "",
  reviewDate: "",
  reviewDueDate: "",
  version: "1.0",
  equipmentIds: [],
  stockItemIds: [],
  dishIds: [],
});

const method = (templateKey, category, name, values = {}) => ({
  ...emptySafeMethod(),
  templateKey,
  category,
  name,
  step: name,
  ...values,
});

const yesNoCheck = (safetyPoint, whyImportant, question) => ({
  safetyPoint,
  whyImportant,
  question,
  responseType: "YES_NO",
  answer: "",
  details: "",
});

const textCheck = (safetyPoint, whyImportant, question) => ({
  safetyPoint,
  whyImportant,
  question,
  responseType: "TEXT",
  answer: "",
  details: "",
});

// Wording is deliberately concise and paraphrased. Each record remains a draft until
// the operator documents what the site actually does and signs it off.
export const SFBB_SAFE_METHODS = [
  method("personal-hygiene", "Cross-contamination", "Personal hygiene and fitness to work", {
    hazardTypes: ["Biological", "Physical"],
    safetyPoint: "Staff wash hands effectively, wear suitable clean clothing and report illness, cuts or sores.",
    whyImportant: "People can transfer harmful organisms or foreign material to food.",
    checkMethod: "Observe practices and confirm anyone returning after vomiting or diarrhoea has been symptom-free for at least 48 hours.",
    monitoringMethod: "Opening check and supervisor observation",
    monitoringFrequency: "Daily",
    correctiveAction: "Remove an unfit person from food handling, protect exposed food and discard food that may be contaminated.",
    preventionAction: "Retrain the person, improve supervision and review clothing, handwashing and illness-reporting arrangements.",
    trainingRequired: "Working with food factsheet; handwashing; illness reporting",
    safetyChecks: [
      yesNoCheck(
        "Staff wash their hands thoroughly before handling or preparing food.",
        "Effective handwashing helps prevent harmful bacteria and viruses spreading to food.",
        "Are all staff trained to wash their hands before preparing food?"
      ),
      yesNoCheck(
        "Staff wear clean work clothes while working with food.",
        "Clothing can carry dirt and bacteria into food-preparation areas.",
        "Do staff wear clean work clothes?"
      ),
      yesNoCheck(
        "Staff change into work clothes before starting where this forms part of the site procedure.",
        "Keeping work clothing separate reduces contamination brought in from outside.",
        "Do staff change clothes before starting work?"
      ),
      textCheck(
        "Work clothes are suitable for the task and protect food from contamination.",
        "Suitable clothing limits contact, loose fibres, hair and pocket contents reaching food.",
        "Describe the work clothes staff wear."
      ),
      textCheck(
        "Clean or disposable aprons are available and changed after raw-food tasks.",
        "Aprons protect work clothing and can be changed before moving to ready-to-eat work.",
        "What type of aprons do you use?"
      ),
      textCheck(
        "Aprons are assigned to suitable tasks and changed at the right point.",
        "Task controls reduce transfer from raw meat, poultry, eggs or unwashed produce.",
        "Which tasks do you use each apron type for?"
      ),
      yesNoCheck(
        "Hair is kept tied back during food preparation.",
        "Secured hair is less likely to enter food and discourages staff from touching it.",
        "Do staff keep hair tied back?"
      ),
      yesNoCheck(
        "Suitable hats or hairnets are worn where the site procedure requires them.",
        "Hair covering provides another barrier against physical contamination and touching hair.",
        "Do staff wear hats or hairnets when preparing food?"
      ),
      yesNoCheck(
        "Watches and jewellery are removed before preparation, apart from any permitted plain band.",
        "Jewellery can collect contamination or fall into food.",
        "Do staff remove watches and jewellery before preparing food?"
      ),
      yesNoCheck(
        "Staff do not smoke, vape, eat or chew gum while handling food and avoid touching the face or hair.",
        "Hand-to-face contact, coughing and sneezing can transfer harmful organisms to hands and food.",
        "Are staff trained in these restrictions and when to rewash their hands?"
      ),
      yesNoCheck(
        "Food handlers report symptoms and understand fitness-to-work restrictions.",
        "An unwell person may spread harmful bacteria or viruses to food and equipment.",
        "Do food handlers understand what illness or symptoms they must report?"
      ),
      yesNoCheck(
        "A person who had vomiting or diarrhoea does not return to food handling until symptom-free for at least 48 hours.",
        "A person can still carry and spread harmful organisms after symptoms stop.",
        "Do managers check the 48-hour symptom-free period before return?"
      ),
      yesNoCheck(
        "Cuts and sores are reported and fully covered with a brightly coloured waterproof dressing.",
        "Covering wounds prevents contamination and makes a lost dressing easier to see.",
        "Do staff report and correctly cover cuts or sores?"
      ),
      textCheck(
        "Outdoor clothes are kept away from food-preparation areas.",
        "Outdoor clothing can carry dirt and bacteria into the kitchen.",
        "Where do staff change and store outdoor clothes?"
      ),
      textCheck(
        "Clean protective clothing is available for visitors entering food areas.",
        "Visitors can bring contamination into a food-preparation area.",
        "Where are clean visitor uniforms or disposable aprons kept?"
      ),
    ],
  }),
  method("cloths", "Cross-contamination", "Cloths", {
    hazardTypes: ["Biological", "Allergen"],
    safetyPoint: "Use disposable cloths where practical and keep reusable cloths task-specific, clean, disinfected and dry.",
    whyImportant: "Used or damp cloths can spread bacteria, viruses and allergens between areas.",
    checkMethod: "Inspect cloth use, storage, laundering and availability during service.",
    monitoringMethod: "Visual check",
    monitoringFrequency: "Every shift",
    correctiveAction: "Remove the cloth, clean and disinfect anything it touched, and discard food that may be contaminated.",
    preventionAction: "Increase clean-cloth supplies, introduce colour/task separation and retrain staff.",
  }),
  method("separating-foods", "Cross-contamination", "Separating foods", {
    hazardTypes: ["Biological", "Allergen"],
    safetyPoint: "Keep raw, unwashed and allergen-containing foods separate from ready-to-eat or allergen-free food.",
    whyImportant: "Separation prevents harmful organisms and allergens reaching food that will receive no further safe treatment.",
    checkMethod: "Check delivery, storage, preparation areas, equipment and workflow.",
    monitoringMethod: "Opening check and supervisor observation",
    monitoringFrequency: "Daily",
    correctiveAction: "Stop work, isolate affected items, clean and disinfect, replace utensils and discard food where safety is uncertain.",
    preventionAction: "Change layout or timing, provide dedicated equipment and reinforce separation training.",
  }),
  method("food-allergies", "Cross-contamination", "Food hypersensitivity and allergies", {
    hazardTypes: ["Allergen"],
    safetyPoint: "Keep accurate ingredient information and prevent allergen cross-contact from delivery through service.",
    whyImportant: "An incorrect answer or cross-contact can cause a severe or life-threatening reaction.",
    checkMethod: "Check labels, recipe data, substitutions, staff knowledge and the customer-order handoff.",
    monitoringMethod: "Recipe/menu review and order check",
    monitoringFrequency: "When changed",
    correctiveAction: "Do not guess; stop the order, verify ingredients and remake with clean equipment if safe control cannot be confirmed.",
    preventionAction: "Update recipes and labels immediately, control substitutions and refresh staff training.",
    records: "Allergen matrix, recipe records and HACCP evidence log",
  }),
  method("physical-chemical", "Cross-contamination", "Physical and chemical contamination", {
    hazardTypes: ["Chemical", "Physical"],
    safetyPoint: "Store and use chemicals safely and protect food from glass, packaging, pests and other foreign objects.",
    whyImportant: "Chemicals or foreign objects can injure customers or make food unsafe.",
    checkMethod: "Inspect chemical storage, labels, breakables, packaging removal and food protection.",
    monitoringMethod: "Opening check and incident reporting",
    monitoringFrequency: "Daily",
    correctiveAction: "Isolate and discard affected food, stop the source and contact the supplier where relevant.",
    preventionAction: "Review chemical control, storage and maintenance; replace unsafe equipment and retrain staff.",
  }),
  method("pest-control", "Cross-contamination", "Pest control", {
    hazardTypes: ["Biological", "Physical"],
    safetyPoint: "Keep the premises proofed, clean and free of pest activity.",
    whyImportant: "Pests carry harmful organisms and can contaminate food and packaging.",
    checkMethod: "Look for droppings, damage, tracks, nesting, insects and entry points inside and outside.",
    monitoringMethod: "Opening check plus scheduled inspection",
    monitoringFrequency: "Daily",
    correctiveAction: "Protect or discard affected food, clean and disinfect, and arrange competent pest-control action promptly.",
    preventionAction: "Repair entry points, improve waste and stock control, and review contractor visits.",
  }),
  method("maintenance", "Cross-contamination", "Maintenance", {
    hazardTypes: ["Biological", "Chemical", "Physical"],
    safetyPoint: "Keep the structure, work surfaces, ventilation, drainage and equipment in safe working order.",
    whyImportant: "Damaged or failing facilities are difficult to clean and may contaminate food or admit pests.",
    checkMethod: "Inspect the premises and equipment and follow up every outstanding repair.",
    monitoringMethod: "Opening check and weekly walk-round",
    monitoringFrequency: "Weekly",
    correctiveAction: "Take faulty equipment or areas out of use, protect food and use a safe alternative until repaired.",
    preventionAction: "Plan servicing and preventive maintenance and track repairs to closure.",
  }),

  method("handwashing", "Cleaning", "Handwashing", {
    hazardTypes: ["Biological", "Allergen"],
    safetyPoint: "Provide suitable handwashing facilities and require effective washing at the right times.",
    whyImportant: "Hands are a major route for spreading harmful organisms and allergens.",
    checkMethod: "Check hot water, liquid soap, disposable towels and staff technique.",
    monitoringMethod: "Opening check and observation",
    monitoringFrequency: "Daily",
    correctiveAction: "Stop food handling until hands and facilities are made safe; protect or discard affected food.",
    preventionAction: "Restock supplies, repair facilities, retrain staff and improve supervision.",
  }),
  method("cleaning-effectively", "Cleaning", "Cleaning effectively", {
    hazardTypes: ["Biological", "Chemical", "Allergen"],
    safetyPoint: "Clean first, then disinfect food-contact and high-touch items using correct dilution and contact time.",
    whyImportant: "Disinfection is unreliable when grease or debris remains, and incorrect chemicals can contaminate food.",
    checkMethod: "Inspect results and verify product, dilution, contact time and drying method.",
    monitoringMethod: "Visual check against cleaning schedule",
    monitoringFrequency: "Every shift",
    correctiveAction: "Re-clean and disinfect, protect food and discard anything that may have been contaminated.",
    preventionAction: "Review products and instructions, update the schedule and retrain staff.",
  }),
  method("clear-clean-as-you-go", "Cleaning", "Clear and clean as you go", {
    hazardTypes: ["Biological", "Chemical", "Physical", "Allergen"],
    safetyPoint: "Remove waste and spills promptly and keep work areas clear throughout preparation and service.",
    whyImportant: "A clear workflow reduces cross-contamination, pests and slips while making effective cleaning possible.",
    checkMethod: "Supervisor observes work areas, waste handling and task changeovers.",
    monitoringMethod: "Continuous observation",
    monitoringFrequency: "Every shift",
    correctiveAction: "Pause the task, remove waste, clean and disinfect, and assess exposed food.",
    preventionAction: "Change workflow or bin provision and reinforce clean-as-you-go responsibilities.",
  }),
  method("cleaning-schedule", "Cleaning", "Cleaning schedule", {
    hazardTypes: ["Biological", "Chemical", "Physical", "Allergen"],
    safetyPoint: "Document what is cleaned, how, when, by whom and with what precautions.",
    whyImportant: "A complete schedule makes routine and less frequent cleaning consistent and verifiable.",
    checkMethod: "Compare completed cleaning records with the schedule and inspect results.",
    monitoringMethod: "Schedule sign-off and manager verification",
    monitoringFrequency: "Daily",
    correctiveAction: "Complete missed cleaning before the area or equipment is used and assess affected food.",
    preventionAction: "Adjust frequency, ownership or resources and follow up repeat misses.",
    records: "Cleaning schedule and HACCP evidence log",
  }),

  method("chilled-storage", "Chilling", "Chilled storage and display", {
    controlType: "CCP",
    isCCP: true,
    hazardTypes: ["Biological"],
    safetyPoint: "Keep food that requires chilling at a safe temperature and within its use-by or validated shelf life.",
    whyImportant: "Poor chilling allows harmful bacteria to grow.",
    checkMethod: "Check equipment at opening and verify between food packs with a clean, disinfected probe.",
    limitMax: "8",
    limitText: "Chilled food at 8°C or below; set equipment at 5°C or below. Apply the one-off 4-hour display rule only where controlled.",
    monitoringMethod: "Display/dial check with regular independent probe verification",
    monitoringFrequency: "Daily",
    correctiveAction: "Move food to working equipment; discard food above safe chill control for over four hours or where time is unknown.",
    preventionAction: "Repair or replace equipment, review loading/display practice and retrain staff.",
  }),
  method("chilling-hot-food", "Chilling", "Chilling down hot food", {
    controlType: "CCP",
    isCCP: true,
    hazardTypes: ["Biological"],
    safetyPoint: "Cool cooked food as quickly as possible using a method proven suitable for the product and portion size.",
    whyImportant: "Slow cooling gives harmful bacteria time to grow.",
    checkMethod: "Probe the centre at defined intervals during a validation check and record the cooling profile.",
    limitText: "Use the site's validated cooling time and temperature limit.",
    monitoringMethod: "Clean, disinfected probe and time record",
    monitoringFrequency: "Per batch",
    correctiveAction: "Re-cook if appropriate or discard food that was not cooled safely.",
    preventionAction: "Use smaller portions or faster equipment, allow enough time and revalidate the method.",
  }),
  method("defrosting", "Chilling", "Defrosting", {
    hazardTypes: ["Biological"],
    safetyPoint: "Defrost thoroughly using a controlled method while keeping raw food separate.",
    whyImportant: "Part-frozen food may cook unevenly and unsafe defrosting can support bacterial growth or spread contamination.",
    checkMethod: "Check for ice crystals and, for birds, flexible joints before cooking.",
    monitoringMethod: "Visual/manual check before cooking",
    monitoringFrequency: "Per batch",
    correctiveAction: "Continue controlled defrosting and recheck, or use a safe alternative menu item.",
    preventionAction: "Allow more time, reduce portion size or change to a safer defrosting method.",
  }),
  method("freezing", "Chilling", "Freezing", {
    hazardTypes: ["Biological"],
    safetyPoint: "Freeze promptly in protected, manageable portions and keep frozen storage working effectively.",
    whyImportant: "Slow or interrupted freezing can allow harmful bacteria to grow and creates unsafe refreezing decisions.",
    checkMethod: "Check freezer display/dial and periodically verify with an independent thermometer.",
    limitMax: "-18",
    limitText: "Target frozen storage at -18°C or below and follow product instructions.",
    monitoringMethod: "Freezer temperature check",
    monitoringFrequency: "Daily",
    correctiveAction: "Move hard-frozen food to safe storage; safely defrost food that has begun to soften; discard products that cannot be safely recovered.",
    preventionAction: "Repair equipment, reorganise loading, service freezers and retrain staff.",
  }),

  method("cooking-safely", "Cooking", "Cooking safely", {
    controlType: "CCP",
    isCCP: true,
    hazardTypes: ["Biological"],
    safetyPoint: "Cook food thoroughly and protect cooked food from raw-food contamination.",
    whyImportant: "A validated time and core-temperature combination kills harmful bacteria.",
    checkMethod: "Probe the centre or thickest part with a clean, disinfected probe and apply product-specific visual checks.",
    limitMin: "75",
    limitText: "Validated combinations include 80°C/6 sec, 75°C/30 sec, 70°C/2 min, 65°C/10 min or 60°C/45 min.",
    monitoringMethod: "Core temperature and time check",
    monitoringFrequency: "Per batch",
    correctiveAction: "Continue cooking and recheck; divide the batch or use suitable alternative equipment if needed.",
    preventionAction: "Review time, temperature, batch size and equipment; maintain equipment and retrain staff.",
  }),
  method("foods-extra-care", "Cooking", "Foods that need extra care", {
    hazardTypes: ["Biological", "Allergen"],
    safetyPoint: "Identify higher-risk foods and apply product-specific sourcing, handling, cooking and service controls.",
    whyImportant: "Eggs, rice, pulses, shellfish, liver and similar foods can need controls beyond the standard process.",
    checkMethod: "Review relevant menu items and observe the specific control for each one.",
    monitoringMethod: "Menu review and per-batch check",
    monitoringFrequency: "Per batch",
    correctiveAction: "Stop service of the item and cook, chill, replace or discard it according to the relevant safe method.",
    preventionAction: "Update recipes and purchasing rules and provide task-specific training.",
  }),
  method("reheating", "Cooking", "Reheating", {
    controlType: "CCP",
    isCCP: true,
    hazardTypes: ["Biological"],
    safetyPoint: "Reheat food thoroughly once, then serve immediately or transfer directly to hot holding.",
    whyImportant: "Thorough reheating destroys bacteria that may have grown after cooking.",
    checkMethod: "Probe the centre; test several areas of microwaved or large dishes.",
    limitMin: "75",
    limitText: "Reach the site's validated safe cooking time/temperature combination; reheat only once.",
    monitoringMethod: "Core temperature check",
    monitoringFrequency: "Per batch",
    correctiveAction: "Reheat longer and recheck if equipment is working; otherwise use a safe alternative or discard.",
    preventionAction: "Review portion size, equipment, time and temperature and retrain staff.",
  }),
  method("checking-menu", "Cooking", "Checking your menu", {
    hazardTypes: ["Biological", "Allergen"],
    safetyPoint: "Map each key cooked dish to a suitable cooking check and current ingredient/allergen information.",
    whyImportant: "Different dishes need different evidence that the safe method works.",
    checkMethod: "Review every key dish and link it to its required check, limit and record.",
    monitoringMethod: "Menu and recipe review",
    monitoringFrequency: "When changed",
    correctiveAction: "Hold the dish until a safe check and accurate allergen information are confirmed.",
    preventionAction: "Make recipe and HACCP review part of every menu, supplier or ingredient change.",
    records: "Dish links, recipe records and HACCP evidence log",
  }),
  method("hot-holding", "Cooking", "Hot holding", {
    controlType: "CCP",
    isCCP: true,
    hazardTypes: ["Biological"],
    safetyPoint: "Place thoroughly cooked food into preheated holding equipment and keep it hot until service.",
    whyImportant: "Food below the holding limit can support harmful bacterial growth.",
    checkMethod: "Probe the centre with a clean, disinfected probe.",
    limitMin: "63",
    limitText: "Keep at 63°C or above; use the one-off 2-hour display exception only where controlled.",
    monitoringMethod: "Core temperature check",
    monitoringFrequency: "Per service",
    correctiveAction: "Reheat safely once and return to holding, chill safely for later use, or discard.",
    preventionAction: "Check equipment, settings and batch size; repair equipment and retrain staff.",
  }),
  method("ready-to-eat", "Cooking", "Ready-to-eat food", {
    hazardTypes: ["Biological", "Allergen"],
    safetyPoint: "Protect ready-to-eat food from raw-food contact, allergens, hands, equipment and unsafe storage time.",
    whyImportant: "There may be no later cooking step to remove contamination.",
    checkMethod: "Check separation, handling, labels, use-by dates and chilled storage.",
    monitoringMethod: "Opening check and supervisor observation",
    monitoringFrequency: "Daily",
    correctiveAction: "Isolate and discard food where contamination or shelf life cannot be ruled out; clean and disinfect the area.",
    preventionAction: "Improve separation, labelling and workflow and retrain staff.",
  }),
  method("acrylamide", "Cooking", "Acrylamide", {
    hazardTypes: ["Chemical"],
    safetyPoint: "Control recipe, storage and cooking colour for relevant starchy foods and follow product instructions.",
    whyImportant: "High-temperature overcooking can increase acrylamide formation.",
    checkMethod: "Check product instructions, oil control and finished colour against the site's standard.",
    monitoringMethod: "Visual/product instruction check",
    monitoringFrequency: "Per batch",
    correctiveAction: "Do not serve over-darkened food; correct the time, temperature or preparation method.",
    preventionAction: "Standardise recipes and settings and train staff to the agreed colour standard.",
  }),

  method("opening-closing", "Management", "Opening and closing checks", {
    hazardTypes: ["Biological", "Chemical", "Physical", "Allergen"],
    safetyPoint: "Complete and sign the site's opening and closing checks every trading day.",
    whyImportant: "These checks confirm the basic conditions needed to prepare and leave food safely.",
    checkMethod: "Complete the daily diary checklist and record every problem or change.",
    monitoringMethod: "Daily diary sign-off",
    monitoringFrequency: "Daily",
    correctiveAction: "Correct failed checks before food work continues or before the premises is closed.",
    preventionAction: "Investigate repeats, change resources or procedures and review at the 4-weekly check.",
    records: "Daily diary entries",
  }),
  method("extra-checks", "Management", "Extra checks", {
    hazardTypes: ["Biological", "Chemical", "Physical", "Allergen"],
    safetyPoint: "Schedule less frequent checks such as deep cleaning, maintenance, dishwasher, probe and pest checks.",
    whyImportant: "Some important controls cannot be demonstrated by the daily opening and closing routine alone.",
    checkMethod: "Complete the scheduled check and record the result and follow-up.",
    monitoringMethod: "Extra-check schedule",
    monitoringFrequency: "Weekly",
    correctiveAction: "Make the item safe, record the action and assign any repair or follow-up to an owner.",
    preventionAction: "Adjust check frequency or resources where repeats show the schedule is not effective.",
    records: "Extra-check diary entries",
  }),
  method("prove-it", "Management", "Prove it", {
    hazardTypes: ["Biological"],
    safetyPoint: "Use a clean, disinfected and accurate probe to demonstrate temperature-based methods are effective.",
    whyImportant: "Measured evidence confirms that the process reaches and maintains its safety limit.",
    checkMethod: "Record product or equipment, time, result, limit, operator and corrective action; verify probe accuracy regularly.",
    monitoringMethod: "Probe record and calibration check",
    monitoringFrequency: "Weekly",
    correctiveAction: "Treat affected food according to its safe method and replace or calibrate an inaccurate probe.",
    preventionAction: "Store and clean probes correctly, replace batteries and schedule accuracy checks.",
    records: "Prove-it records and probe calibration records",
  }),
  method("allergen-information", "Management", "Managing food allergen information", {
    hazardTypes: ["Allergen"],
    safetyPoint: "Maintain accurate written allergen information, including labels for prepacked-for-direct-sale food where applicable.",
    whyImportant: "Customers and staff need reliable information to avoid serious reactions.",
    checkMethod: "Compare recipes, labels, supplier data, substitutions and menu information.",
    monitoringMethod: "Recipe and label verification",
    monitoringFrequency: "When changed",
    correctiveAction: "Stop sale or service until accurate information and safe handling can be confirmed.",
    preventionAction: "Use change control for every recipe, product and supplier update and refresh staff training.",
    records: "Allergen matrix, ingredient labels, supplier information and training records",
  }),
  method("training-supervision", "Management", "Training and supervision", {
    hazardTypes: ["Biological", "Chemical", "Physical", "Allergen"],
    safetyPoint: "Train each person in the safe methods relevant to their work and verify competence through supervision.",
    whyImportant: "Controls work only when people understand and consistently follow them.",
    checkMethod: "Review training records, question staff and observe tasks.",
    monitoringMethod: "Training matrix and supervisor observation",
    monitoringFrequency: "Monthly",
    correctiveAction: "Restrict unsupervised work and provide immediate instruction or refresher training.",
    preventionAction: "Add induction, refresher and change-triggered training with named supervisors.",
    records: "Staff training records",
  }),
  method("customers", "Management", "Customers and complaints", {
    hazardTypes: ["Biological", "Chemical", "Physical", "Allergen"],
    safetyPoint: "Record, investigate and respond to food-safety complaints and suspected illness promptly.",
    whyImportant: "Complaints can reveal a control failure that needs immediate action.",
    checkMethod: "Review complaint records for open actions and recurring themes.",
    monitoringMethod: "Complaint review",
    monitoringFrequency: "4-weekly",
    correctiveAction: "Preserve information, identify affected food, contact the relevant authority when needed and make the process safe.",
    preventionAction: "Update the affected safe method, communicate learning and verify actions at review.",
    records: "Complaint and investigation log",
  }),
  method("suppliers-contractors", "Management", "Suppliers and contractors", {
    hazardTypes: ["Biological", "Chemical", "Physical", "Allergen"],
    safetyPoint: "Use reputable suppliers and competent contractors and retain traceability and contact information.",
    whyImportant: "Unsafe products or poorly controlled work can introduce hazards into the business.",
    checkMethod: "Check deliveries, invoices, allergen data, approval status and contractor controls.",
    monitoringMethod: "Delivery check and supplier review",
    monitoringFrequency: "Per delivery",
    correctiveAction: "Reject or isolate unsuitable goods and contact the supplier; control contractor work around food.",
    preventionAction: "Review or replace poor performers and keep the approved supplier/contact list current.",
    records: "Invoices, delivery records and suppliers list",
  }),
  method("stock-control", "Management", "Stock control", {
    hazardTypes: ["Biological", "Allergen"],
    safetyPoint: "Buy suitable quantities, rotate stock, protect labels and use food within safe dates.",
    whyImportant: "Good stock control prevents unsafe age, damaged packaging and lost ingredient or allergen information.",
    checkMethod: "Check dates, labels, packaging, storage order and first-in-first-out rotation.",
    monitoringMethod: "Delivery and opening check",
    monitoringFrequency: "Daily",
    correctiveAction: "Isolate and discard or return out-of-date, damaged or unidentifiable stock.",
    preventionAction: "Adjust ordering, storage layout and rotation responsibilities.",
  }),
  method("withdrawal-recall", "Management", "Product withdrawal and recall", {
    hazardTypes: ["Biological", "Chemical", "Physical", "Allergen"],
    safetyPoint: "Identify affected product quickly, stop use or sale, follow official instructions and retain traceability.",
    whyImportant: "Fast, controlled action limits customer exposure to unsafe food.",
    checkMethod: "Test the contact and traceability process and review live alerts affecting the site.",
    monitoringMethod: "Alert review and traceability test",
    monitoringFrequency: "Monthly",
    correctiveAction: "Quarantine affected stock, follow supplier or authority instructions and record quantities and disposal or return.",
    preventionAction: "Correct traceability gaps, update contacts and brief staff after each event or test.",
    records: "Withdrawal/recall log, invoices and supplier contacts",
  }),
];

export const COMPLETION_FIELDS = [
  ["safetyPoint", "safety point"],
  ["whyImportant", "why it matters"],
  ["businessProcedure", "how your site does it"],
  ["checkMethod", "check method"],
  ["monitoringMethod", "monitoring method"],
  ["monitoringFrequency", "monitoring frequency"],
  ["monitoringResponsible", "responsible person or role"],
  ["correctiveAction", "action if things go wrong"],
  ["preventionAction", "how recurrence is prevented"],
  ["verification", "manager verification"],
  ["records", "records retained"],
  ["completedDate", "completion date"],
  ["completedBy", "completed by"],
  ["reviewDueDate", "next review date"],
];

export const normaliseSafeMethod = (source = {}) => {
  const hazards = Array.isArray(source.hazardTypes)
    ? source.hazardTypes
    : source.hazardType
      ? [source.hazardType]
      : ["Biological"];

  return {
    ...emptySafeMethod(),
    ...source,
    appliesToBusiness: source.appliesToBusiness !== false,
    hazardTypes: hazards,
    hazardType: hazards[0] || "Biological",
    equipmentIds: Array.isArray(source.equipmentIds) ? source.equipmentIds : [],
    stockItemIds: Array.isArray(source.stockItemIds)
      ? source.stockItemIds
      : Array.isArray(source.stockIds)
        ? source.stockIds
        : [],
    dishIds: Array.isArray(source.dishIds) ? source.dishIds : [],
    safetyChecks: Array.isArray(source.safetyChecks) ? source.safetyChecks : [],
  };
};

export const getCompletion = (source = {}) => {
  const methodRecord = normaliseSafeMethod(source);
  if (!methodRecord.appliesToBusiness) {
    return { percent: 100, missing: [], notRelevant: true };
  }

  const missing = COMPLETION_FIELDS.filter(([key]) => {
    const value = methodRecord[key];
    return value === null || value === undefined || String(value).trim() === "";
  }).map(([, label]) => label);

  const unansweredChecks = methodRecord.safetyChecks.filter((item) =>
    item?.answer === null || item?.answer === undefined || String(item.answer).trim() === ""
  );
  unansweredChecks.forEach((item) => {
    missing.push(`answer: ${item.question || "safety-point check"}`);
  });

  const total = COMPLETION_FIELDS.length + methodRecord.safetyChecks.length;

  return {
    percent: total ? Math.round(((total - missing.length) / total) * 100) : 0,
    missing,
    notRelevant: false,
  };
};

export const toDateValue = (value) => {
  if (!value) return null;
  if (typeof value.toDate === "function") return value.toDate();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

export const isReviewDue = (source = {}, now = new Date()) => {
  const methodRecord = normaliseSafeMethod(source);
  if (!methodRecord.appliesToBusiness) return false;
  const due = toDateValue(methodRecord.reviewDueDate);
  return !due || due.getTime() < now.getTime();
};

export const evidenceWindowMs = (frequency) => {
  const hour = 60 * 60 * 1000;
  switch (frequency) {
    case "Hourly":
      return 2 * hour;
    case "Twice daily":
      return 16 * hour;
    case "Daily":
      return 36 * hour;
    case "Weekly":
      return 8 * 24 * hour;
    case "4-weekly":
      return 31 * 24 * hour;
    case "Monthly":
      return 35 * 24 * hour;
    default:
      return null;
  }
};
