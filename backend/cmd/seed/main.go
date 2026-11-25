// Command seed fills a development database with demo inventory, equipment and bookings.
//
//	docker compose -f compose.dev.yml exec backend go run ./cmd/seed
//
// Log in to the app once first: your account owns the demo items' changelog entries and
// some of the bookings. Each part is skipped if that table already has data, so running it
// again is safe. Demo booking owners are disabled accounts with @demo.invalid emails.
package main

import (
	"errors"
	"fmt"
	"log"
	"math/rand/v2"
	"os"
	"time"
	"uuid"

	"github.com/evaandev/unnamed-inventory-manager/auth"
	"github.com/evaandev/unnamed-inventory-manager/bookings"
	"github.com/evaandev/unnamed-inventory-manager/database"
	"github.com/evaandev/unnamed-inventory-manager/inventory"
	guuid "github.com/google/uuid"
	"github.com/joho/godotenv"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

func main() {
	if err := godotenv.Load(); err != nil && !os.IsNotExist(err) {
		log.Fatalf("Error loading .env: %s", err)
	}
	db, err := database.Connect()
	if err != nil {
		log.Fatalf("Error connecting to database: %s", err)
	}
	if err := database.Migrate(db); err != nil {
		log.Fatalf("Error migrating database: %s", err)
	}

	owner, err := findOwner(db)
	if err != nil {
		log.Fatal(err)
	}
	log.Printf("Using %s (%s) as the demo data owner", owner.Name, owner.Email)

	if err := db.Transaction(func(tx *gorm.DB) error {
		if err := seedInventory(tx, owner); err != nil {
			return fmt.Errorf("seeding inventory: %w", err)
		}
		if err := seedBookings(tx, owner); err != nil {
			return fmt.Errorf("seeding bookings: %w", err)
		}
		return nil
	}); err != nil {
		log.Fatal(err)
	}
	log.Print("Done")
}

// findOwner picks ADMIN_EMAIL's account, or else the first enabled real account.
func findOwner(db *gorm.DB) (auth.User, error) {
	var user auth.User
	query := db.Where("disabled = ? AND google_id NOT LIKE ?", false, "demo-%")
	if email := os.Getenv("ADMIN_EMAIL"); email != "" {
		if err := db.Where("email = ?", email).First(&user).Error; err == nil {
			return user, nil
		}
	}
	if err := query.Order("name").First(&user).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return user, errors.New("no user accounts yet: log in to the app once, then run the seed again")
		}
		return user, err
	}
	return user, nil
}

// ---------------------------------------------------------------- inventory

type demoItem struct {
	name, manufacturer, part, distributorPart, description string
	quantity                                               int32
	categories                                             []string
}

func seedInventory(tx *gorm.DB, owner auth.User) error {
	var count int64
	if err := tx.Model(&inventory.Item{}).Count(&count).Error; err != nil {
		return err
	}
	if count > 0 {
		log.Printf("Skipping inventory: %d items already exist", count)
		return nil
	}

	// Categories, parents first.
	tree := []struct{ name, parent string }{
		{"Electronics", ""},
		{"Passive components", "Electronics"},
		{"Resistors", "Passive components"},
		{"Capacitors", "Passive components"},
		{"Microcontrollers", "Electronics"},
		{"Sensors", "Electronics"},
		{"Connectors & cables", "Electronics"},
		{"Mechanical", ""},
		{"Fasteners", "Mechanical"},
		{"3D printing filament", "Mechanical"},
		{"Consumables", ""},
	}
	categories := map[string]inventory.ItemCategory{}
	for _, node := range tree {
		category := inventory.ItemCategory{ID: uuid.New(), CategoryName: node.name}
		if node.parent != "" {
			parentID := categories[node.parent].ID
			category.ParentID = &parentID
		}
		if err := tx.Create(&category).Error; err != nil {
			return err
		}
		categories[node.name] = category
	}

	items := []demoItem{
		{"Arduino Uno Rev3", "Arduino", "A000066", "1050-1024-ND", "ATmega328P development board.", 14, []string{"Microcontrollers"}},
		{"Raspberry Pi Pico", "Raspberry Pi", "SC0915", "2648-SC0915CT-ND", "RP2040 microcontroller board.", 22, []string{"Microcontrollers"}},
		{"ESP32-DevKitC", "Espressif Systems", "ESP32-DEVKITC-32E", "1965-ESP32-DEVKITC-32E-ND", "ESP32 Wi-Fi and Bluetooth development board.", 6, []string{"Microcontrollers"}},
		{"Resistor kit, 1/4 W, 1% (E12)", "Yageo", "MFR-25 kit", "", "Assorted through-hole metal film resistors, 10 Ω to 1 MΩ.", 3, []string{"Resistors"}},
		{"10 kΩ resistor, 1/4 W", "Yageo", "MFR-25FBF52-10K", "13-MFR-25FBF52-10KCT-ND", "Through-hole metal film, 1%.", 480, []string{"Resistors"}},
		{"330 Ω resistor, 1/4 W", "Yageo", "MFR-25FBF52-330R", "13-MFR-25FBF52-330RCT-ND", "Through-hole metal film, 1%. Common LED resistor.", 260, []string{"Resistors"}},
		{"100 nF ceramic capacitor", "KEMET", "C320C104K5R5TA", "399-4264-ND", "50 V X7R through-hole decoupling capacitor.", 350, []string{"Capacitors"}},
		{"100 µF electrolytic capacitor", "Panasonic", "EEU-FR1C101", "P10373-ND", "16 V radial aluminium electrolytic.", 8, []string{"Capacitors"}},
		{"HC-SR04 ultrasonic sensor", "Generic", "HC-SR04", "", "2 cm to 4 m distance sensor, 5 V.", 0, []string{"Sensors"}},
		{"BME280 breakout", "Adafruit", "2652", "1528-1359-ND", "Temperature, humidity and pressure sensor, I²C/SPI.", 9, []string{"Sensors"}},
		{"MPU-6050 IMU breakout", "Generic", "GY-521", "", "6-axis accelerometer and gyroscope, I²C.", 12, []string{"Sensors"}},
		{"Jumper wires, male to male (40 pk)", "Adafruit", "758", "1528-1154-ND", "20 cm breadboard jumpers.", 25, []string{"Connectors & cables"}},
		{"Half-size breadboard", "Adafruit", "64", "1528-2143-ND", "400 tie points.", 18, []string{"Connectors & cables"}},
		{"USB-C cable, 1 m", "Generic", "USB-C-1M", "", "USB 2.0, data and charging.", 4, []string{"Connectors & cables"}},
		{"M3 × 10 mm socket head screw", "McMaster-Carr", "91290A115", "", "Black-oxide alloy steel, pack of 100.", 600, []string{"Fasteners"}},
		{"M3 hex nut", "McMaster-Carr", "90591A250", "", "Zinc-plated steel, pack of 100.", 540, []string{"Fasteners"}},
		{"M3 heat-set insert", "McMaster-Carr", "94180A331", "", "Brass, for 3D-printed parts.", 7, []string{"Fasteners", "3D printing filament"}},
		{"PLA filament, 1.75 mm, black (1 kg)", "Prusament", "PLA-BLK-1KG", "", "Spool for the Prusa printers.", 5, []string{"3D printing filament"}},
		{"PETG filament, 1.75 mm, clear (1 kg)", "Prusament", "PETG-CLR-1KG", "", "Spool for functional parts.", 2, []string{"3D printing filament"}},
		{"Lead-free solder, 0.8 mm (250 g)", "Kester", "24-7068-7601", "KE1704-ND", "SAC305 rosin-core solder wire.", 6, []string{"Consumables"}},
		{"Solder wick, 2.5 mm", "Chemtronics", "60-3-5", "", "Desoldering braid, 1.5 m.", 0, []string{"Consumables"}},
		{"Kapton tape, 25 mm", "3M", "5413", "", "Heat-resistant polyimide tape.", 3, []string{"Consumables"}},
	}

	for _, demo := range items {
		item := inventory.Item{
			ID:               uuid.New(),
			ItemName:         demo.name,
			Quantity:         demo.quantity,
			Manufacturer:     demo.manufacturer,
			ManufacturerPart: demo.part,
			DistributorPart:  demo.distributorPart,
			Description:      demo.description,
		}
		for _, name := range demo.categories {
			item.Categories = append(item.Categories, categories[name])
		}
		if err := tx.Omit("Categories.*").Create(&item).Error; err != nil {
			return err
		}
		if err := tx.Create(&inventory.Changelog{
			UserID:      uuid.UUID(owner.ID),
			ItemID:      item.ID,
			Quantity:    demo.quantity,
			Action:      inventory.ItemCreated,
			ChangeTime:  time.Now(),
			Description: "Demo data",
		}).Error; err != nil {
			return err
		}
	}

	log.Printf("Created %d categories and %d items", len(tree), len(items))
	return nil
}

// ---------------------------------------------------------------- bookings

func seedBookings(tx *gorm.DB, owner auth.User) error {
	var count int64
	if err := tx.Model(&bookings.Equipment{}).Count(&count).Error; err != nil {
		return err
	}
	if count > 0 {
		log.Printf("Skipping equipment and bookings: %d pieces of equipment already exist", count)
		return nil
	}

	equipment := []bookings.Equipment{
		{Name: "Prusa MK4 #1", Category: "3D printers", Location: "Maker bench A", Description: "FDM printer, 250 × 210 × 220 mm build volume. PLA and PETG loaded.", Status: bookings.EquipmentActive},
		{Name: "Prusa MK4 #2", Category: "3D printers", Location: "Maker bench A", Description: "FDM printer, 250 × 210 × 220 mm build volume. PLA loaded.", Status: bookings.EquipmentActive},
		{Name: "Bambu Lab X1 Carbon", Category: "3D printers", Location: "Maker bench B", Description: "Enclosed CoreXY printer with multi-material AMS. Ask before printing ABS or ASA.", Status: bookings.EquipmentActive},
		{Name: "Creality Ender-3 V2", Category: "3D printers", Location: "Maker bench B", Description: "Entry-level FDM printer, 220 × 220 × 250 mm.", Status: bookings.EquipmentMaintenance, MaintenanceNote: "Waiting on a replacement hotend."},
		{Name: "Hakko FX-888D", Category: "Soldering", Location: "Electronics bench 1", Description: "Digital soldering station, 70 W. Bring your own solder.", Status: bookings.EquipmentActive},
		{Name: "Weller WE1010", Category: "Soldering", Location: "Electronics bench 2", Description: "Temperature-controlled soldering station, 70 W.", Status: bookings.EquipmentActive},
		{Name: "JBC hot air rework station", Category: "Soldering", Location: "Electronics bench 1", Description: "Hot air station for SMD rework. Fume extractor required.", Status: bookings.EquipmentActive},
		{Name: "T-962A reflow oven", Category: "Soldering", Location: "Electronics bench 2", Description: "Benchtop reflow oven for small SMD boards. Profiles for leaded and lead-free paste.", Status: bookings.EquipmentActive},
		{Name: "Rigol DS1054Z oscilloscope", Category: "Test equipment", Location: "Test bench", Description: "4-channel, 50 MHz digital oscilloscope with probes.", Status: bookings.EquipmentActive},
		{Name: "Rigol DP832 power supply", Category: "Test equipment", Location: "Test bench", Description: "Triple-output programmable bench power supply, 195 W.", Status: bookings.EquipmentActive},
		{Name: "40 W laser cutter", Category: "Fabrication", Location: "Workshop", Description: "CO₂ laser cutter, 300 × 200 mm bed. Safety training required.", Status: bookings.EquipmentActive},
	}
	for i := range equipment {
		if equipment[i].Category == "3D printers" {
			equipment[i].OpenHour, equipment[i].CloseHour = 0, 24
		} else {
			equipment[i].OpenHour, equipment[i].CloseHour = bookings.DefaultOpenHour, bookings.DefaultCloseHour
		}
	}
	if err := tx.Create(&equipment).Error; err != nil {
		return err
	}

	// Disabled accounts that only exist to own demo bookings. They cannot log in.
	var people []auth.User
	for _, name := range []string{"Alex", "Sam", "Priya", "Jordan", "Maya", "Chris"} {
		id := guuid.New()
		person := auth.User{ID: id, Name: name, Email: fmt.Sprintf("%s@demo.invalid", name), GoogleID: "demo-" + id.String(), Disabled: true}
		if err := tx.Where("email = ?", person.Email).FirstOrCreate(&person).Error; err != nil {
			return err
		}
		people = append(people, person)
	}

	purposes := []string{"Enclosure prototype", "PCB rework", "Demo fixture", "Class project", "Repair", "Debugging the motor driver", "Spare parts", ""}
	rng := rand.New(rand.NewPCG(7, 7)) // fixed seed: the same layout every run
	var created []bookings.Booking

	// Touching counts as overlapping here, so demo bookings never form back-to-back runs.
	add := func(equipmentID int, userID guuid.UUID, start, end time.Time) {
		for _, b := range created {
			if b.EquipmentID == equipmentID && !start.After(b.End) && !b.Start.After(end) {
				return
			}
		}
		created = append(created, bookings.Booking{
			EquipmentID: equipmentID,
			UserID:      userID,
			Start:       start.UTC(),
			End:         end.UTC(),
			Purpose:     purposes[rng.IntN(len(purposes))],
		})
	}

	// One booking in progress right now, so "In use" shows on the schedule.
	now := time.Now()
	thisHour := now.Truncate(time.Hour)
	add(equipment[0].ID, people[0].ID, thisHour, thisHour.Add(2*time.Hour))

	midnight := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, time.Local)
	for _, eq := range equipment {
		if eq.Status != bookings.EquipmentActive {
			continue
		}
		for day := 0; day < bookings.BookingDays; day++ {
			for n := rng.IntN(3); n > 0; n-- { // 0-2 bookings per day
				startHour := eq.OpenHour + rng.IntN(eq.CloseHour-eq.OpenHour)
				hours := min(1+rng.IntN(4), eq.CloseHour-startHour)
				start := midnight.AddDate(0, 0, day).Add(time.Duration(startHour) * time.Hour)
				if start.Before(now) {
					continue
				}
				userID := people[rng.IntN(len(people))].ID
				if rng.Float64() < 0.2 {
					userID = owner.ID
				}
				add(eq.ID, userID, start, start.Add(time.Duration(hours)*time.Hour))
			}
		}
	}
	// Make sure "My bookings" is never empty.
	tomorrow := midnight.AddDate(0, 0, 1)
	add(equipment[8].ID, owner.ID, tomorrow.Add(10*time.Hour), tomorrow.Add(12*time.Hour))

	if err := tx.Omit(clause.Associations).Create(&created).Error; err != nil {
		return err
	}
	log.Printf("Created %d pieces of equipment, %d demo users and %d bookings", len(equipment), len(people), len(created))
	return nil
}
