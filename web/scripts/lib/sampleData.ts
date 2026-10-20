/**
 * Vocabulary for the sample population created by scripts/seed.ts.
 *
 * People are built from a region (names, hometown, language) and a persona
 * (role, skills, interests, needs, goals). Each persona's needs are other
 * personas' skills, so the sample population complements itself.
 */

export interface NameGroup {
    weight: number;
    /** Overrides the region's languages for this group. */
    languages?: string[];
    male: string[];
    female: string[];
    surnames: string[];
}

export interface Region {
    key: string;
    weight: number;
    hometowns: string[];
    languages: string[];
    groups: NameGroup[];
}

export const REGIONS: Region[] = [
    {
        key: "karnataka",
        weight: 25,
        hometowns: ["Bengaluru", "Mysuru", "Mangaluru", "Hubballi", "Davanagere", "Shivamogga", "Udupi", "Belagavi", "Tumakuru", "Hassan"],
        languages: ["Kannada"],
        groups: [
            {
                weight: 62,
                male: ["Rakesh", "Prajwal", "Chethan", "Darshan", "Manoj", "Suhas", "Kiran", "Abhishek", "Nikhil", "Shreyas", "Pradeep", "Vinay", "Sumanth", "Akash", "Tejas"],
                female: ["Ananya", "Kavya", "Sahana", "Spoorthi", "Bhavana", "Ramya", "Pooja", "Deeksha", "Chaitra", "Megha", "Sinchana", "Apoorva", "Rashmi", "Varsha"],
                surnames: ["Gowda", "Shetty", "Hegde", "Rao", "Bhat", "Kulkarni", "Naik", "Patil", "Murthy", "Shenoy", "Kamath", "Prasad", "Reddy", "Acharya"]
            },
            {
                weight: 24,
                languages: ["Urdu", "Kannada"],
                male: ["Mohammed Irfan", "Syed Faizan", "Sameer", "Imran", "Mohammed Ashraf", "Tabrez", "Junaid", "Arbaaz"],
                female: ["Ayesha", "Sana", "Fathima", "Heena", "Afreen", "Nazia", "Rukhsar", "Sumayya"],
                surnames: ["Khan", "Pasha", "Syed", "Shariff", "Ahmed", "Baig", "Nawaz"]
            },
            {
                weight: 14,
                male: ["Rohan", "Clinton", "Melwyn", "Joel", "Royston", "Brandon"],
                female: ["Joyce", "Reshma", "Sharon", "Prema", "Vanessa", "Nikita"],
                surnames: ["D'Souza", "Pinto", "Fernandes", "Lobo", "Rodrigues", "Menezes", "D'Mello"]
            }
        ]
    },
    {
        key: "kerala",
        weight: 12,
        hometowns: ["Kochi", "Thrissur", "Kozhikode", "Thiruvananthapuram", "Kottayam", "Kannur", "Palakkad"],
        languages: ["Malayalam"],
        groups: [
            {
                weight: 50,
                male: ["Arjun", "Vishnu", "Akhil", "Rahul", "Sreejith", "Gokul", "Adarsh"],
                female: ["Anjali", "Aswathy", "Gopika", "Neha", "Nimisha", "Lakshmi", "Devika"],
                surnames: ["Nair", "Menon", "Pillai", "Kurup", "Warrier", "Nambiar"]
            },
            {
                weight: 28,
                male: ["Abin", "Jibin", "Alan", "Jerin", "Ebin", "Tony"],
                female: ["Aleena", "Ann Mary", "Merin", "Riya", "Anitta", "Teena"],
                surnames: ["Thomas", "Joseph", "Mathew", "Kurian", "Jacob", "Varghese", "George"]
            },
            {
                weight: 22,
                male: ["Muhammed Shafi", "Ashiq", "Nihal", "Shahid", "Afsal"],
                female: ["Fathima Nasrin", "Hiba", "Shahana", "Nourin", "Sana"],
                surnames: ["Ali", "K", "P", "Rahman", "Basheer"]
            }
        ]
    },
    {
        key: "tamilnadu",
        weight: 12,
        hometowns: ["Chennai", "Coimbatore", "Madurai", "Salem", "Tiruchirappalli", "Vellore", "Tirunelveli"],
        languages: ["Tamil"],
        groups: [
            {
                weight: 75,
                male: ["Karthik", "Arun", "Vignesh", "Pradeep", "Surya", "Harish", "Dinesh", "Gowtham", "Bala"],
                female: ["Divya", "Keerthana", "Priya", "Nandhini", "Swetha", "Janani", "Abinaya", "Harini"],
                surnames: ["Subramanian", "Krishnan", "Rajendran", "Natarajan", "Venkatesan", "Iyer", "R", "S", "M"]
            },
            {
                weight: 13,
                male: ["Samuel", "Jebaraj", "Joshua", "Prince"],
                female: ["Jenifer", "Shalini", "Evangeline", "Hepzibah"],
                surnames: ["Raj", "Daniel", "Paul", "David"]
            },
            {
                weight: 12,
                male: ["Mohamed Riyaz", "Asif", "Sheik Abdullah"],
                female: ["Thasleem", "Asma", "Rizwana"],
                surnames: ["Basha", "Ismail", "Hameed"]
            }
        ]
    },
    {
        key: "telugu",
        weight: 14,
        hometowns: ["Hyderabad", "Warangal", "Vijayawada", "Guntur", "Visakhapatnam", "Tirupati", "Nellore", "Kurnool"],
        languages: ["Telugu"],
        groups: [
            {
                weight: 68,
                male: ["Sai Teja", "Venkatesh", "Harsha", "Charan", "Pavan", "Srinivas", "Rohith", "Manikanta", "Naveen"],
                female: ["Sravani", "Lakshmi", "Harika", "Sindhu", "Mounika", "Bhargavi", "Sahithi", "Keerthi"],
                surnames: ["Reddy", "Naidu", "Chowdary", "Varma", "Rao", "Goud", "Yadav", "Kumar"]
            },
            {
                weight: 32,
                languages: ["Urdu", "Telugu"],
                male: ["Syed Abdul Rahman", "Mohammed Faraz", "Mohd Zaid", "Abdul Raheem", "Mir Hasan", "Owais"],
                female: ["Asma Fatima", "Mehwish", "Zoya", "Sumaiya", "Areeba", "Nida"],
                surnames: ["Quadri", "Hussaini", "Siddiqui", "Ansari", "Mohiuddin", "Jafri"]
            }
        ]
    },
    {
        key: "north",
        weight: 13,
        hometowns: ["Lucknow", "Kanpur", "Patna", "Varanasi", "Prayagraj", "Delhi", "Gorakhpur", "Bhopal", "Indore", "Dehradun"],
        languages: ["Hindi"],
        groups: [
            {
                weight: 70,
                male: ["Aditya", "Ankit", "Rohit", "Saurabh", "Vivek", "Shubham", "Aman", "Utkarsh", "Prateek", "Harshit"],
                female: ["Shivani", "Nidhi", "Priyanka", "Shruti", "Tanya", "Aditi", "Vaishnavi", "Muskan"],
                surnames: ["Sharma", "Verma", "Mishra", "Singh", "Gupta", "Yadav", "Srivastava", "Tiwari", "Pandey", "Chauhan"]
            },
            {
                weight: 30,
                languages: ["Urdu", "Hindi"],
                male: ["Faizan", "Arshad", "Zaid", "Saad", "Hamza", "Rehan"],
                female: ["Alina", "Nazia", "Iqra", "Mariam", "Zainab", "Bushra"],
                surnames: ["Khan", "Ansari", "Qureshi", "Siddiqui", "Rizvi", "Naqvi"]
            }
        ]
    },
    {
        key: "maharashtra",
        weight: 6,
        hometowns: ["Pune", "Nagpur", "Kolhapur", "Nashik", "Mumbai", "Aurangabad"],
        languages: ["Marathi"],
        groups: [
            {
                weight: 85,
                male: ["Omkar", "Siddharth", "Pranav", "Tejas", "Aniket", "Sarthak"],
                female: ["Sayali", "Rutuja", "Mrunal", "Gauri", "Aishwarya", "Prachi"],
                surnames: ["Deshpande", "Joshi", "Jadhav", "Pawar", "Kale", "Kulkarni", "Shinde"]
            },
            {
                weight: 15,
                languages: ["Urdu", "Marathi"],
                male: ["Aamir", "Sohail"],
                female: ["Saba", "Farheen"],
                surnames: ["Shaikh", "Mulla", "Inamdar"]
            }
        ]
    },
    {
        key: "bengal",
        weight: 5,
        hometowns: ["Kolkata", "Durgapur", "Siliguri", "Howrah"],
        languages: ["Bengali"],
        groups: [
            {
                weight: 100,
                male: ["Arnab", "Sourav", "Debanjan", "Ritwik", "Sayan", "Anirban"],
                female: ["Ankita", "Moumita", "Sreeja", "Riya", "Poulami", "Ishita"],
                surnames: ["Banerjee", "Chatterjee", "Mukherjee", "Das", "Ghosh", "Sen", "Bose"]
            }
        ]
    },
    {
        key: "west",
        weight: 5,
        hometowns: ["Ahmedabad", "Surat", "Vadodara", "Jaipur", "Udaipur", "Rajkot"],
        languages: ["Gujarati", "Hindi"],
        groups: [
            {
                weight: 100,
                male: ["Harsh", "Parth", "Dhruv", "Jay", "Kunal", "Yash"],
                female: ["Krupa", "Dhwani", "Riddhi", "Khushi", "Hetal", "Jinal"],
                surnames: ["Patel", "Shah", "Mehta", "Desai", "Jain", "Agarwal", "Trivedi"]
            }
        ]
    },
    {
        key: "punjab",
        weight: 4,
        hometowns: ["Ludhiana", "Amritsar", "Jalandhar", "Chandigarh", "Patiala"],
        languages: ["Punjabi", "Hindi"],
        groups: [
            {
                weight: 100,
                male: ["Gurpreet Singh", "Jaskaran Singh", "Harpreet Singh", "Navjot Singh", "Arshdeep Singh"],
                female: ["Simran Kaur", "Manpreet Kaur", "Navneet Kaur", "Jasleen Kaur", "Harleen Kaur"],
                surnames: ["Gill", "Sandhu", "Dhillon", "Grewal", "Bajwa"]
            }
        ]
    },
    {
        key: "northeast",
        weight: 4,
        hometowns: ["Guwahati", "Shillong", "Dibrugarh", "Jorhat", "Imphal"],
        languages: ["Assamese", "Hindi"],
        groups: [
            {
                weight: 60,
                male: ["Bhaskar", "Rituraj", "Pranjal", "Dhrubajyoti"],
                female: ["Ankita", "Bornali", "Pallavi", "Rimjhim"],
                surnames: ["Bora", "Gogoi", "Kalita", "Saikia", "Baruah"]
            },
            {
                weight: 40,
                male: ["Kevin", "Daniel", "Wanbok", "Ibanroi"],
                female: ["Mercy", "Grace", "Daphisha", "Ibadahun"],
                surnames: ["Lyngdoh", "Sangma", "Marak", "Kharkongor", "Syiem"]
            }
        ]
    }
];

/** Where people in Bengaluru say they live. */
export const LOCALITIES = [
    "Banashankari", "Hosakerehalli", "RR Nagar", "Kengeri", "Jayanagar", "JP Nagar", "BTM Layout",
    "HSR Layout", "Koramangala", "Indiranagar", "Whitefield", "Marathahalli", "Bellandur",
    "Electronic City", "Malleshwaram", "Rajajinagar", "Basavanagudi", "Yelahanka", "Hebbal",
    "Frazer Town", "Vijayanagar", "Kumaraswamy Layout"
];

export const COLLEGES = {
    engineering: [
        "PES University", "RV College of Engineering", "BMS College of Engineering",
        "MS Ramaiah Institute of Technology", "Dayananda Sagar College of Engineering",
        "Bangalore Institute of Technology", "Presidency University", "REVA University", "CMR University"
    ],
    general: [
        "PES University", "Christ University", "Jain University", "St. Joseph's University",
        "Mount Carmel College", "Bangalore University", "NMKRV College", "Presidency University",
        "REVA University", "Kristu Jayanti College"
    ]
};

export interface Persona {
    key: string;
    weight: number;
    roles: { student: string[]; working: string[] };
    studentShare: number;
    education: { student: string[]; working: string[] };
    skills: string[];
    interests: string[];
    needs: string[];
    goals: string[];
    activities: string[];
    situations: string[];
    collaboration: string[];
    bios: { student: string[]; working: string[] };
}

/*
 * Bio placeholders: {locality}, {hometown}, {college}, {years} ({years} in
 * working bios only). Kept short and uneven: people rarely write polished bios.
 */
export const PERSONAS: Persona[] = [
    {
        key: "fullstack",
        weight: 14,
        roles: { student: ["Student"], working: ["Software Developer", "Full Stack Developer", "Frontend Developer"] },
        studentShare: 0.6,
        education: { student: ["MCA", "BCA", "B.E. (CSE)", "B.Tech (IT)"], working: ["B.E. (CSE)", "MCA", "B.Tech (CSE)", "B.Sc (Computer Science)"] },
        skills: ["React", "Node.js", "JavaScript", "TypeScript", "MongoDB", "Express", "Next.js", "HTML", "CSS", "Tailwind CSS", "REST APIs", "Git"],
        interests: ["Web Development", "Open Source", "Hackathons", "Startups", "Cricket", "Gaming"],
        needs: ["UI/UX", "Figma", "AWS", "Docker", "System Design", "Product Management", "Content Writing", "Machine Learning"],
        goals: ["Find a hackathon teammate", "Build a portfolio project", "Find a project partner", "Get my side project in front of users"],
        activities: ["Building a personal project", "Preparing for a hackathon", "Working on an academic project", "Preparing for placements"],
        situations: [
            "I can handle the code but my designs look terrible. Want someone who can make it look decent.",
            "Building a small app for our hostel mess feedback. Need someone to help with deployment.",
            "Registered for a hackathon next month, team is one person short.",
            "Have a working MERN app, want feedback from someone who has shipped real products."
        ],
        collaboration: ["Project-based", "Hackathons", "Study"],
        bios: {
            student: [
                "{college} student. Mostly React and Node.",
                "From {hometown}, staying in {locality}. I like building small tools that fix annoying problems.",
                "Learning Next.js these days. Always up for a hackathon.",
                "MERN stack. Trying to write clean code, not just working code."
            ],
            working: [
                "Web developer, {years}. Weekends are for side projects and cricket.",
                "Mostly React and Node at work. From {hometown}, now in {locality}.",
                "Frontend at a small product company in {locality}. Happy to review your portfolio."
            ]
        }
    },
    {
        key: "data",
        weight: 12,
        roles: { student: ["Student"], working: ["Data Analyst", "Data Scientist", "ML Engineer"] },
        studentShare: 0.55,
        education: { student: ["MCA", "M.Sc (Data Science)", "B.Tech (AI & ML)", "B.Sc (Statistics)"], working: ["M.Sc (Statistics)", "B.Tech (CSE)", "MCA", "M.Tech"] },
        skills: ["Python", "Pandas", "SQL", "Machine Learning", "Power BI", "Tableau", "Statistics", "Deep Learning", "NLP", "Excel"],
        interests: ["Artificial Intelligence", "Data Science", "Research", "Kaggle", "Chess", "Stock Market"],
        needs: ["React", "Node.js", "Research Writing", "AWS", "Data Visualization", "Public Speaking", "Docker"],
        goals: ["Work on a research project", "Build an ML project end to end", "Find a study partner", "Learn a new technology"],
        activities: ["Working on research", "Preparing for placements", "Building a personal project", "Learning a new technology"],
        situations: [
            "Have a model that works in a notebook, no idea how to turn it into an app people can use.",
            "Want to write a paper from my mini project, need someone who knows research writing.",
            "Preparing for data analyst interviews, looking for someone to do mock SQL rounds with.",
            "Doing a Kaggle competition, would like a teammate."
        ],
        collaboration: ["Research", "Project-based", "Study"],
        bios: {
            student: [
                "Python, SQL and too many Jupyter notebooks.",
                "Into NLP, especially for Indian languages. {college}.",
                "Kaggle on weekends. From {hometown}."
            ],
            working: [
                "{years} working with data. I make dashboards for a living and charts for fun.",
                "Analytics at a fintech in {locality}. Originally from {hometown}.",
                "ML at work, chess after work."
            ]
        }
    },
    {
        key: "mobile",
        weight: 6,
        roles: { student: ["Student"], working: ["Android Developer", "Flutter Developer", "Mobile Developer"] },
        studentShare: 0.6,
        education: { student: ["BCA", "MCA", "B.E. (ISE)"], working: ["B.E. (CSE)", "MCA", "BCA"] },
        skills: ["Flutter", "Dart", "Kotlin", "Android", "Firebase", "Java", "REST APIs"],
        interests: ["Mobile Development", "Startups", "Gadgets", "Open Source", "Football"],
        needs: ["UI/UX", "Figma", "Node.js", "Product Management", "Social Media Marketing"],
        goals: ["Publish an app on the Play Store", "Find a project partner", "Build a portfolio project"],
        activities: ["Building a personal project", "Working on a startup idea", "Working on an academic project"],
        situations: [
            "Built an app for my parents' shop, want to make it usable for other small shops.",
            "Need a backend person for a Flutter app, I only know Firebase.",
            "Want to get my first app on the Play Store before placements."
        ],
        collaboration: ["Project-based", "Hackathons"],
        bios: {
            student: [
                "Flutter dev. I've built more apps than I've published.",
                "Android since school. From {hometown}, now in {locality}."
            ],
            working: [
                "Mobile apps, {years}. Kotlin and Flutter.",
                "Building apps for a startup in {locality}. Looking for people to build side projects with."
            ]
        }
    },
    {
        key: "cloud",
        weight: 6,
        roles: { student: ["Student"], working: ["DevOps Engineer", "Cloud Engineer", "Site Reliability Engineer"] },
        studentShare: 0.4,
        education: { student: ["MCA", "B.E. (CSE)"], working: ["B.E. (ECE)", "B.Tech (CSE)", "MCA"] },
        skills: ["AWS", "Docker", "Kubernetes", "Linux", "CI/CD", "Terraform", "Azure", "Bash"],
        interests: ["Cloud Computing", "Open Source", "Homelab", "Trekking"],
        needs: ["React", "Python", "System Design", "Public Speaking", "Technical Writing"],
        goals: ["Prepare for a cloud certification", "Mentor someone", "Find a study partner"],
        activities: ["Preparing for a certification", "Learning a new technology", "Working on a side project"],
        situations: [
            "Preparing for AWS Solutions Architect. Studying alone is slow.",
            "Happy to help people deploy their projects, want help with frontend in return.",
            "Want to start writing technical blogs but keep putting it off."
        ],
        collaboration: ["Mentoring", "Study", "Project-based"],
        bios: {
            student: [
                "Preparing for AWS certs. Linux person.",
                "{college}. I break servers so you don't have to."
            ],
            working: [
                "Infra, {years}. AWS and Kubernetes.",
                "Happy to help anyone stuck on deployment. Trekking on long weekends."
            ]
        }
    },
    {
        key: "java",
        weight: 8,
        roles: { student: ["Student"], working: ["Backend Developer", "Java Developer", "Software Engineer"] },
        studentShare: 0.7,
        education: { student: ["MCA", "B.E. (CSE)", "B.Tech (CSE)", "BCA"], working: ["B.E. (CSE)", "MCA", "M.Tech"] },
        skills: ["Java", "Spring Boot", "DSA", "SQL", "System Design", "Microservices", "C++"],
        interests: ["Competitive Programming", "Placements", "Chess", "Cricket"],
        needs: ["System Design", "Mock Interviews", "React", "Docker", "Public Speaking", "Spoken English"],
        goals: ["Prepare for placements", "Find a study partner", "Practice mock interviews"],
        activities: ["Preparing for placements", "Preparing for exams", "Practising DSA"],
        situations: [
            "Placements start soon. Want someone to solve two LeetCode problems a day with.",
            "Good at DSA, weak at speaking in interviews. Want to practise mock interviews.",
            "Learning Spring Boot, looking for someone a bit ahead of me."
        ],
        collaboration: ["Study", "Mentoring"],
        bios: {
            student: [
                "Java and DSA. 400+ LeetCode, still nervous in interviews.",
                "{college}. Preparing for placements like everyone else.",
                "Competitive programming on Codeforces. From {hometown}."
            ],
            working: [
                "Backend, {years}. Spring Boot, mostly.",
                "Java at work, chess on weekends. Happy to help with placement prep."
            ]
        }
    },
    {
        key: "security",
        weight: 4,
        roles: { student: ["Student"], working: ["Security Analyst", "Penetration Tester"] },
        studentShare: 0.6,
        education: { student: ["MCA", "B.Sc (Cyber Security)", "B.E. (CSE)"], working: ["B.Tech (CSE)", "MCA"] },
        skills: ["Cybersecurity", "Ethical Hacking", "Network Security", "Linux", "Python", "Wireshark"],
        interests: ["CTFs", "Cybersecurity", "Privacy", "Open Source"],
        needs: ["React", "Cloud Security", "Technical Writing", "AWS"],
        goals: ["Find a CTF teammate", "Learn a new technology", "Build a portfolio project"],
        activities: ["Practising for CTFs", "Learning a new technology", "Preparing for a certification"],
        situations: [
            "Our CTF team needs one more person who knows web exploitation.",
            "Want to build a small security scanner as a portfolio project."
        ],
        collaboration: ["Hackathons", "Study"],
        bios: {
            student: [
                "CTFs on weekends. Mostly web and forensics.",
                "{college}. Learning security one broken lab at a time."
            ],
            working: [
                "Security, {years}. Happy to review your app for obvious holes."
            ]
        }
    },
    {
        key: "design",
        weight: 8,
        roles: { student: ["Design Student", "Student"], working: ["UI/UX Designer", "Product Designer", "Graphic Designer"] },
        studentShare: 0.45,
        education: { student: ["B.Des", "BCA", "BA (Visual Communication)"], working: ["B.Des", "M.Des", "BFA", "B.Sc (Animation)"] },
        skills: ["UI/UX", "Figma", "User Research", "Prototyping", "Illustration", "Adobe Illustrator", "Canva", "Typography"],
        interests: ["Design", "Art", "Photography", "Cafes", "Music"],
        needs: ["React", "Flutter", "Frontend Development", "Marketing", "Photography"],
        goals: ["Build a portfolio project", "Find someone to collaborate with", "Freelance with a developer"],
        activities: ["Working on a design portfolio", "Freelancing", "Building a personal project"],
        situations: [
            "I design apps but can't code them. Looking for a developer to build one with.",
            "Want real projects for my portfolio, not just Dribbble shots.",
            "Doing UX research for a college project, need people to interview."
        ],
        collaboration: ["Project-based", "Freelance", "Mentoring"],
        bios: {
            student: [
                "Design student at {college}. I like interfaces that feel calm.",
                "Illustration and UI. Cafe hopping in {locality}."
            ],
            working: [
                "Designing products, {years}. Figma all day.",
                "Graphic design turning into UX. From {hometown}."
            ]
        }
    },
    {
        key: "business",
        weight: 7,
        roles: { student: ["MBA Student", "Student"], working: ["Product Manager", "Business Analyst", "Associate Consultant"] },
        studentShare: 0.5,
        education: { student: ["MBA", "BBA", "PGDM"], working: ["MBA", "B.E. + MBA", "BBA"] },
        skills: ["Product Management", "Market Research", "Business Strategy", "Excel", "Public Speaking", "Presentation Skills"],
        interests: ["Startups", "Entrepreneurship", "Stock Market", "Podcasts", "Badminton"],
        needs: ["React", "Node.js", "Data Analysis", "UI/UX", "Financial Modelling"],
        goals: ["Validate a startup idea", "Find a technical co-founder", "Prepare for case competitions"],
        activities: ["Working on a startup idea", "Preparing for a case competition", "Doing an internship"],
        situations: [
            "Have a startup idea for college canteens, need a developer to build the first version.",
            "Case competition next month, need someone good with data.",
            "Want to move from consulting to product. Looking for people already in product."
        ],
        collaboration: ["Project-based", "Mentoring"],
        bios: {
            student: [
                "MBA at {college}. Talk to me about startups.",
                "Case competitions and filter coffee."
            ],
            working: [
                "{years} in consulting and product. Ex-engineer, still miss coding sometimes.",
                "Spreadsheets by day, startup podcasts by night."
            ]
        }
    },
    {
        key: "finance",
        weight: 6,
        roles: { student: ["CA Aspirant", "B.Com Student"], working: ["Chartered Accountant", "Financial Analyst", "Accountant"] },
        studentShare: 0.5,
        education: { student: ["B.Com", "CA Intermediate", "BBA (Finance)"], working: ["CA", "M.Com", "MBA (Finance)"] },
        skills: ["Accounting", "Financial Modelling", "Excel", "Taxation", "Stock Market Analysis", "Tally"],
        interests: ["Stock Market", "Personal Finance", "Economics", "Cricket", "Reading"],
        needs: ["Python", "Data Analysis", "Power BI", "Web Development", "Content Writing"],
        goals: ["Learn Python for finance", "Find a study partner", "Start a finance blog"],
        activities: ["Preparing for exams", "Doing articleship", "Learning a new technology"],
        situations: [
            "Want to automate my Excel reports with Python, don't know where to start.",
            "Preparing for CA finals, looking for a serious study partner.",
            "Want to start a personal finance page in Kannada and English."
        ],
        collaboration: ["Study", "Mentoring", "Project-based"],
        bios: {
            student: [
                "Commerce student at {college}. Learning Python so I can stop doing things manually.",
                "Markets, mutual funds and too much chai."
            ],
            working: [
                "Finance, {years}. Happy to explain taxes to confused freelancers.",
                "Numbers person from {hometown}. Learning to automate my reports."
            ]
        }
    },
    {
        key: "content",
        weight: 6,
        roles: { student: ["Student"], working: ["Content Writer", "Digital Marketer", "Social Media Manager"] },
        studentShare: 0.4,
        education: { student: ["BA (Journalism)", "BA (English)", "BBA"], working: ["BA (English)", "MA (Mass Communication)", "BBA"] },
        skills: ["Content Writing", "SEO", "Social Media Marketing", "Copywriting", "Canva", "Video Editing"],
        interests: ["Writing", "Podcasts", "Movies", "Travel", "Food"],
        needs: ["Web Development", "Photography", "Video Editing", "UI/UX", "Data Analysis"],
        goals: ["Start a YouTube channel", "Freelance with a developer", "Build a personal brand"],
        activities: ["Freelancing", "Running a blog", "Building a personal brand"],
        situations: [
            "Run a small food page about {locality}. Need a photographer to tag along on weekends.",
            "Want a simple website for my writing portfolio.",
            "Starting a podcast about life after moving to Bengaluru, looking for a co-host."
        ],
        collaboration: ["Freelance", "Project-based"],
        bios: {
            student: [
                "Write about food and films. From {hometown}.",
                "Running a small blog while studying at {college}."
            ],
            working: [
                "Writing and marketing, {years}. I make brands sound human.",
                "Social media for small brands. Film reviewer on the side."
            ]
        }
    },
    {
        key: "creative",
        weight: 5,
        roles: { student: ["Student"], working: ["Photographer", "Videographer", "Video Editor"] },
        studentShare: 0.4,
        education: { student: ["BA (Visual Communication)", "BCA", "B.Sc (Animation)"], working: ["BA (Visual Communication)", "Diploma in Photography", "BFA"] },
        skills: ["Photography", "Video Editing", "Adobe Premiere Pro", "Lightroom", "Videography", "After Effects"],
        interests: ["Photography", "Travel", "Movies", "Trekking", "Street Food"],
        needs: ["Social Media Marketing", "Web Development", "Content Writing", "Business Strategy"],
        goals: ["Find someone to collaborate with", "Build a portfolio project", "Grow my freelance work"],
        activities: ["Freelancing", "Shooting a short film", "Building a portfolio"],
        situations: [
            "Shooting a short film for a college fest, need an editor and a writer.",
            "I take good photos but have no idea how to get clients online.",
            "Want a portfolio website that doesn't look like a template."
        ],
        collaboration: ["Freelance", "Project-based"],
        bios: {
            student: [
                "Camera always in the bag. From {hometown}.",
                "Short films with friends at {college}."
            ],
            working: [
                "Behind the camera, {years}. Weddings pay the bills, short films are the fun part.",
                "Street and event shoots, mostly around {locality}."
            ]
        }
    },
    {
        key: "music",
        weight: 4,
        roles: { student: ["Student"], working: ["Music Teacher", "Music Producer", "Musician"] },
        studentShare: 0.5,
        education: { student: ["B.Com", "BCA", "BA (Music)"], working: ["BA (Music)", "MA (Music)", "B.E."] },
        skills: ["Guitar", "Keyboard", "Carnatic Music", "Hindustani Vocals", "Music Production", "Tabla"],
        interests: ["Music", "Live Gigs", "Indie Music", "Movies"],
        needs: ["Video Editing", "Social Media Marketing", "Photography", "Music Production"],
        goals: ["Find bandmates", "Find someone to collaborate with", "Teach music"],
        activities: ["Jamming on weekends", "Recording a cover", "Teaching music"],
        situations: [
            "Looking for a vocalist and a drummer to jam with on weekends.",
            "Recording an original song, need someone to shoot and edit the video.",
            "Teach Carnatic vocals online, want help growing on Instagram."
        ],
        collaboration: ["Jamming", "Project-based", "Mentoring"],
        bios: {
            student: [
                "Carnatic vocals since childhood. {college}.",
                "Making beats in my hostel room. Looking for people to make music with."
            ],
            working: [
                "Music, {years}. Play at small cafes in {locality} sometimes.",
                "Teach guitar on weekends. From {hometown}."
            ]
        }
    },
    {
        key: "teaching",
        weight: 4,
        roles: { student: ["B.Ed Student", "Student"], working: ["Teacher", "Tutor", "Language Trainer"] },
        studentShare: 0.4,
        education: { student: ["B.Ed", "BA (English)", "M.Sc (Mathematics)"], working: ["B.Ed", "M.Sc (Mathematics)", "MA (English)"] },
        skills: ["Teaching", "Spoken English", "Mathematics", "Public Speaking", "Kannada", "Hindi"],
        interests: ["Education", "Reading", "Volunteering", "Languages"],
        needs: ["Video Editing", "Web Development", "Canva", "Content Writing"],
        goals: ["Mentor someone", "Start online classes", "Find someone to collaborate with"],
        activities: ["Teaching", "Volunteering at an NGO", "Creating course content"],
        situations: [
            "Volunteer teaching government school kids on Saturdays. Need more volunteers.",
            "Want to put my maths lessons on YouTube but don't know editing.",
            "Can help with spoken English or Kannada in exchange for help with computers."
        ],
        collaboration: ["Mentoring", "Study"],
        bios: {
            student: [
                "Training to be a teacher. Weekend volunteer in {locality}.",
                "Maths student. Nobody is bad at maths, just badly taught."
            ],
            working: [
                "Teaching, {years}. Learning to code slowly.",
                "Tutor in {locality}. Spoken English and maths."
            ]
        }
    },
    {
        key: "research",
        weight: 3,
        roles: { student: ["Research Scholar", "PhD Student"], working: ["Research Assistant", "Assistant Professor"] },
        studentShare: 0.7,
        education: { student: ["M.Tech", "M.Sc", "MCA"], working: ["Ph.D", "M.Tech", "M.Phil"] },
        skills: ["Research Writing", "LaTeX", "Statistics", "Literature Review", "MATLAB", "R"],
        interests: ["Research", "Artificial Intelligence", "Reading", "Teaching"],
        needs: ["Python", "Machine Learning", "Data Visualization", "Deep Learning"],
        goals: ["Work on a research project", "Co-author a paper", "Mentor someone"],
        activities: ["Working on research", "Writing a paper", "Teaching"],
        situations: [
            "Writing a paper on crop disease detection, need help with the deep learning part.",
            "Can guide students writing their first IEEE paper."
        ],
        collaboration: ["Research", "Mentoring"],
        bios: {
            student: [
                "Research scholar at {college}. Remote sensing and too much MATLAB.",
                "PhD life. Writing, rewriting, rewriting again."
            ],
            working: [
                "Teaching and research, {years}. Happy to help students with their first paper."
            ]
        }
    },
    {
        key: "sports",
        weight: 3,
        roles: { student: ["Student"], working: ["Fitness Coach", "Sports Coach"] },
        studentShare: 0.5,
        education: { student: ["B.P.Ed", "BBA", "B.Com"], working: ["B.P.Ed", "Diploma in Sports Science", "B.Sc"] },
        skills: ["Fitness Coaching", "Yoga", "Cricket", "Football", "Badminton", "Running"],
        interests: ["Fitness", "Sports", "Running", "Nutrition", "Trekking"],
        needs: ["Social Media Marketing", "Video Editing", "Web Development", "Business Strategy"],
        goals: ["Start a running group", "Grow my coaching", "Find people to play with"],
        activities: ["Training for a marathon", "Coaching", "Playing weekend matches"],
        situations: [
            "Our Sunday cricket team in {locality} needs two more players.",
            "Training for the TCS World 10K, want running partners.",
            "Coach yoga online, want help with a simple booking website."
        ],
        collaboration: ["Mentoring", "Project-based"],
        bios: {
            student: [
                "Weekend cricketer. From {hometown}.",
                "Runner. Training for my first half marathon."
            ],
            working: [
                "Coaching, {years}. Mornings in Cubbon Park.",
                "Strength and yoga coach in {locality}."
            ]
        }
    },
    {
        key: "founder",
        weight: 2,
        roles: { student: ["Student Founder"], working: ["Founder", "Co-founder"] },
        studentShare: 0.4,
        education: { student: ["BBA", "B.E. (CSE)", "MBA"], working: ["B.E.", "MBA", "B.Tech"] },
        skills: ["Entrepreneurship", "Fundraising", "Pitching", "Sales", "Product Management"],
        interests: ["Startups", "Entrepreneurship", "Podcasts", "Investing"],
        needs: ["React", "Node.js", "Flutter", "UI/UX", "Social Media Marketing", "Accounting"],
        goals: ["Find a technical co-founder", "Hire my first intern", "Validate a startup idea"],
        activities: ["Working on a startup idea", "Talking to customers", "Applying to incubators"],
        situations: [
            "Early-stage startup helping kirana stores go digital. Looking for a technical co-founder.",
            "Applying to an incubator, need an MVP in 6 weeks.",
            "Want honest feedback on a pitch deck."
        ],
        collaboration: ["Project-based", "Mentoring"],
        bios: {
            student: [
                "Student founder at {college}'s incubation centre.",
                "Trying to build something people actually pay for."
            ],
            working: [
                "Building something for small shops in Bengaluru. Ex-sales.",
                "Founder, second attempt. The first one taught me a lot."
            ]
        }
    }
];

export const AVAILABILITY = [
    "Weekday evenings", "Weekends", "Weekday mornings", "Flexible", "After college hours",
    "Sunday mornings", "Late nights", "Saturday afternoons"
];

export const INTERACTION = [
    { value: "Either", weight: 45 },
    { value: "Online", weight: 30 },
    { value: "In-person", weight: 25 }
];