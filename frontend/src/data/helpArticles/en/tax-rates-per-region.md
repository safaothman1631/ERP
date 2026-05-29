# Tax rates per region

Iraq has two tax regimes. Kurdistan Region applies its own rates and customs; federal Iraq follows the central government's. Zoho Kurdish supports both at the location level.

## Location → tax mapping

Each company location is assigned a governorate. Tax rules for that governorate apply to sales made at that location.

## Default rates

| Region                 | Sales tax | Notes                                |
| ---------------------- | --------- | ------------------------------------ |
| Kurdistan Region       | varies    | tobacco, alcohol, hotels differ      |
| Federal Iraq           | 0–15%     | VAT phasing in by sector             |

## Override per item

Some items (e.g. medical supplies) are exempt nationwide. Set the item's tax group to "Exempt".

## Override per customer

Government entities and diplomatic missions are exempt. Tag the customer "Tax exempt" and they receive zero-tax invoices regardless of item.

## Cross-region sales

If you ship from a KRG warehouse to a federal-Iraq customer, the system applies the destination's tax rules.

## Related

* VAT setup
