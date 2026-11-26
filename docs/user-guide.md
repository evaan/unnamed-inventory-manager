# User Guide

This guide is for SDH staff and students who use the inventory manager day to day.

## Signing in

1. Go to https://inventory.evaan.dev.
2. Click Continue with Google and choose your MUN Google account.
3. New accounts follow the app's sign-up policy. By default, accounts with a `mun.ca` email address are enabled and taken to the inventory.
4. If you see Account disabled, an administrator has not approved your account, or has disabled it. Contact SDH staff to have it enabled.

The app never sees your password. Google handles sign-in.

## The inventory page

The main page lists every item with its name, quantity and stock status:

- In stock: above the item's low stock threshold
- Low stock: above 0, at or below the threshold
- Out of stock: 0

The threshold starts at 10 and can be changed for each item. Set it to 0 to only flag out-of-stock items.

Search. Type in the search box to filter by item name or manufacturer part number. Click Clear search to show everything again.

Categories. Items can belong to one or more categories, and categories can be nested (for example *Passives › Capacitors › Ceramic*). Click categories in the category sidebar to show only items in those categories.

Item details. Click a row to open the details panel. It shows the manufacturer, part numbers, description and links to the datasheet and distributor. Close it with the close button, the Escape key, or by clicking the row again.

## Changing stock

With ModifyItem permission, select an item and use the +1 / +10 / −1 / −10 buttons, or click the quantity to enter an exact number and save it. The quantity cannot go below zero. Every change is recorded in the changelog with your name and the time.

## Adding, editing and deleting items

These actions need the matching permission (see *Permissions* below). Buttons you can't use are hidden.

- New item: click New item, fill in at least the name, quantity, manufacturer and manufacturer part number, add categories if needed, and click Add item. If saving fails, your draft stays open so nothing is lost.
- Edit: open an item, click Edit item, and change its details, low stock threshold or categories, then save. Change the quantity separately using the stock controls. If you try to leave with unsaved changes, the app asks first.
- Delete: open an item and click Delete, then confirm. Deleted items are kept in the database for the changelog but no longer shown.

## Categories

Users with the CreateTag permission can create categories, nest them under a parent, and move them. Users with DeleteTag can delete a category. Deleting a category removes it from every item, but does not delete the items or its child categories. Its children move up to its parent, or to the top level if it had no parent.

## Changelog

Open Changelog from the page header to see item changes, who made them and when. Click an entry to see its details, including before and after values where recorded. Deleted items still appear in the history.

## Equipment bookings

The Bookings page shows bookable equipment (3D printers, soldering stations and so on) on a schedule. Select equipment or a free time slot, choose a date, start time and duration, then click Confirm reservation. Reservations are saved and stay after reloading.

Bookings are limited to the next seven days and eight consecutive hours on the same equipment. They must fit its working hours and cannot overlap another booking. Equipment marked out of service cannot be booked.

Use My bookings to edit or cancel your bookings. Users with BookingManage can also manage other users' reservations. Adding, editing and deleting equipment needs the separate BookingAdd, BookingModify and BookingDelete permissions. Deleting equipment also removes its reservations.

## Settings

Use the theme button in the page header to switch between light and dark mode. Everyone can open Settings to see their account.

Administrators also see:

- Users: search users, enable or disable accounts, and tick the permissions each user has. You cannot disable yourself or remove your own Administrator permission.
- App settings: the sign-up policy (*open*, *whitelist* or *closed*) and the list of approved email domains.

## Permissions

| Permission | Allows |
|------------|--------|
| Administrator | Everything, including managing users and app settings |
| CreateItem | Add new items |
| ModifyItem | Edit items, including their quantity and categories |
| DeleteItem | Delete items |
| CreateTag | Create and move categories |
| DeleteTag | Delete categories |
| BookingAdd / BookingModify / BookingDelete | Manage bookable equipment |
| BookingManage | See and change everyone's reservations |

Any signed-in user who is not disabled can view the inventory.

## Signing out

Click Log out at the top of the page.
